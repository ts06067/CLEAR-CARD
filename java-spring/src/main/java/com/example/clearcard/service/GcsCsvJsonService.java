package com.example.clearcard.service;

import com.fasterxml.jackson.core.JsonFactory;
import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.google.cloud.ReadChannel;
import com.google.cloud.storage.BlobId;
import com.google.cloud.storage.Storage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;

import java.io.*;
import java.nio.channels.Channels;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.zip.GZIPInputStream;

@Slf4j
@Service
@RequiredArgsConstructor
public class GcsCsvJsonService {

    private final Storage storage;

    private static final ObjectMapper MAPPER = new ObjectMapper(
            new JsonFactory()
                    .enable(JsonParser.Feature.ALLOW_COMMENTS)
                    .enable(JsonParser.Feature.ALLOW_TRAILING_COMMA)
    );

    /** Public entry: stream JSON array built from CSV part files listed in a GCS manifest JSON. */
    public StreamingResponseBody jsonArrayFromManifestGs(String gsManifestUri) {
        ManifestInfo mf = readManifest(gsManifestUri);
        return out -> writeJsonArrayFromCsvParts(mf, out);
    }

    /* ---------------------------------------------------------
     * Manifest parsing (robust for your provided shape)
     * --------------------------------------------------------- */

    private static final class ManifestInfo {
        List<String> columns = new ArrayList<>();
        List<String> uris = new ArrayList<>();
        String compression; // "gzip" or null
        long rowCount = -1;
    }

    private ManifestInfo readManifest(String gsManifestUri) {
        if (gsManifestUri == null || !gsManifestUri.startsWith("gs://")) {
            throw new IllegalArgumentException("Manifest must be a gs:// URI: " + gsManifestUri);
        }
        GsLoc loc = splitGs(gsManifestUri);
        String json = readAllUtf8(loc.bucket(), loc.object());

        try {
            JsonNode root = MAPPER.readTree(json);
            ManifestInfo mf = new ManifestInfo();

            // columns: ["..."]
            JsonNode cols = root.get("columns");
            if (cols != null && cols.isArray()) {
                for (JsonNode c : cols) {
                    if (c.isTextual()) mf.columns.add(c.asText());
                }
            }

            // row_count (snake_case)
            JsonNode rc = root.get("row_count");
            if (rc != null && rc.canConvertToLong()) mf.rowCount = rc.asLong();

            // compression (e.g., "gzip")
            JsonNode comp = root.get("compression");
            if (comp != null && comp.isTextual()) mf.compression = comp.asText();

            // chunks: [{ "uri": "gs://...", "rows": ..., "bytes": ... }, ...]
            JsonNode chunks = root.get("chunks");
            if (chunks != null && chunks.isArray()) {
                for (JsonNode ch : chunks) {
                    JsonNode u = ch.get("uri");
                    if (u != null && u.isTextual()) {
                        mf.uris.add(u.asText());
                    }
                }
            }

            // Fallbacks (if someone produces different fields)
            if (mf.uris.isEmpty()) {
                JsonNode uris = root.get("uris");
                if (uris != null && uris.isArray()) {
                    for (JsonNode u : uris) if (u.isTextual()) mf.uris.add(u.asText());
                }
            }

            if (mf.uris.isEmpty()) {
                throw new IllegalStateException("Manifest has no chunk URIs (chunks[].uri or uris[]).");
            }

            log.info("Parsed manifest: parts={}, compression={}, columns={}",
                    mf.uris.size(), mf.compression, mf.columns.size());

            return mf;
        } catch (Exception e) {
            throw new RuntimeException("Failed to parse manifest JSON at " + gsManifestUri + ": " + e.getMessage(), e);
        }
    }

    private String readAllUtf8(String bucket, String object) {
        BlobId id = BlobId.of(bucket, object);
        try (ReadChannel rc = storage.reader(id);
             InputStream in = Channels.newInputStream(rc);
             ByteArrayOutputStream out = new ByteArrayOutputStream(64 * 1024)) {
            in.transferTo(out);
            String s = out.toString(StandardCharsets.UTF_8);
            // Strip BOM
            if (!s.isEmpty() && s.charAt(0) == '\uFEFF') s = s.substring(1);
            return s;
        } catch (IOException e) {
            throw new RuntimeException("Failed to read manifest from gs://" + bucket + "/" + object, e);
        }
    }

    /* ---------------------------------------------------------
     * CSV → JSON array streaming
     * --------------------------------------------------------- */

    private void writeJsonArrayFromCsvParts(ManifestInfo mf, OutputStream out) throws IOException {
        try (BufferedWriter w = new BufferedWriter(new OutputStreamWriter(out, StandardCharsets.UTF_8))) {
            w.write('[');
            boolean wroteAny = false;

            // Determine header: prefer manifest.columns; otherwise read from first part
            List<String> header = mf.columns.isEmpty() ? null : new ArrayList<>(mf.columns);

            for (int idx = 0; idx < mf.uris.size(); idx++) {
                String uri = mf.uris.get(idx);
                if (!uri.startsWith("gs://")) {
                    log.warn("Skipping non-gs URI in manifest: {}", uri);
                    continue;
                }
                GsLoc part = splitGs(uri);

                try (ReadChannel rc = storage.reader(BlobId.of(part.bucket(), part.object()));
                     InputStream baseIn = Channels.newInputStream(rc);
                     InputStream in = needsGzip(mf.compression, uri) ? new GZIPInputStream(baseIn, 32 * 1024) : baseIn;
                     BufferedReader r = new BufferedReader(new InputStreamReader(in, StandardCharsets.UTF_8), 64 * 1024)) {

                    String line;
                    boolean firstLineOfThisFile = true;

                    while ((line = r.readLine()) != null) {
                        if (line.isEmpty()) continue;

                        // Establish header if we don't have one yet
                        if (header == null) {
                            header = parseCsvLine(line);
                            firstLineOfThisFile = false;
                            continue;
                        }

                        // If the first non-empty line of this file equals header, skip it
                        if (firstLineOfThisFile) {
                            List<String> maybeHeader = parseCsvLine(line);
                            firstLineOfThisFile = false;
                            if (maybeHeader.equals(header)) {
                                // header row of this part, skip
                                continue;
                            } else {
                                // this was a data row; fall through with parsed cells
                                writeRowObject(w, header, maybeHeader, wroteAny);
                                wroteAny = true;
                                continue;
                            }
                        }

                        // Normal data row
                        List<String> cells = parseCsvLine(line);
                        writeRowObject(w, header, cells, wroteAny);
                        wroteAny = true;
                    }
                }
            }

            w.write(']');
            w.flush();
        }
    }

    private void writeRowObject(Writer w, List<String> header, List<String> cells, boolean wroteAny) throws IOException {
        Map<String, Object> obj = new LinkedHashMap<>(header.size() * 2);
        for (int i = 0; i < header.size(); i++) {
            String key = header.get(i);
            String val = (i < cells.size()) ? cells.get(i) : "";
            obj.put(key, coerce(val));
        }
        if (wroteAny) w.write(',');
        MAPPER.writeValue(w, obj);
    }

    private boolean needsGzip(String compression, String uri) {
        if (compression != null && "gzip".equalsIgnoreCase(compression)) return true;
        return uri.toLowerCase(Locale.ROOT).endsWith(".gz");
    }

    private Object coerce(String val) {
        if (val == null) return null;
        String s = val.trim();
        if (s.isEmpty()) return "";
        try { return Long.valueOf(s); } catch (NumberFormatException ignore) {}
        try { return Double.valueOf(s); } catch (NumberFormatException ignore) {}
        if ("true".equalsIgnoreCase(s)) return true;
        if ("false".equalsIgnoreCase(s)) return false;
        return s;
    }

    /** RFC4180-ish CSV parser handling quotes, commas, and escaped quotes. */
    private List<String> parseCsvLine(String line) {
        List<String> out = new ArrayList<>();
        StringBuilder cell = new StringBuilder();
        boolean inQuotes = false;
        for (int i = 0; i < line.length(); i++) {
            char c = line.charAt(i);
            if (c == '"') {
                if (inQuotes && i + 1 < line.length() && line.charAt(i + 1) == '"') {
                    cell.append('"'); // escaped quote
                    i++;
                } else {
                    inQuotes = !inQuotes;
                }
            } else if (c == ',' && !inQuotes) {
                out.add(cell.toString());
                cell.setLength(0);
            } else {
                cell.append(c);
            }
        }
        out.add(cell.toString());
        return out;
    }

    private record GsLoc(String bucket, String object) {}
    private GsLoc splitGs(String gsUri) {
        String noScheme = gsUri.substring("gs://".length());
        int slash = noScheme.indexOf('/');
        if (slash <= 0) throw new IllegalArgumentException("Bad gs uri: " + gsUri);
        return new GsLoc(noScheme.substring(0, slash), noScheme.substring(slash + 1));
    }
}

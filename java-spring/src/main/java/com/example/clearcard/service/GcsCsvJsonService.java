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

    /* ===================== Public API (non-streaming) ===================== */

    /**
     * Read manifest at gs://..., load all CSV parts, and return a JSON array as bytes.
     * This method avoids streaming writers entirely (no "Stream closed" risk).
     */
    public byte[] jsonArrayBytesFromManifestGs(String gsManifestUri) {
        ManifestInfo mf = readManifest(gsManifestUri); // throws if invalid

        List<Map<String, Object>> rows = new ArrayList<>(
                (mf.rowCount > 0 && mf.rowCount < Integer.MAX_VALUE) ? (int) mf.rowCount : 1024
        );

        List<String> header = (mf.columns.isEmpty() ? null : new ArrayList<>(mf.columns));

        for (Chunk chunk : mf.chunks) {
            String uri = chunk.uri;
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

                    // establish header if unknown
                    if (header == null) {
                        header = parseCsvLine(line);
                        firstLineOfThisFile = false;
                        continue;
                    }

                    // first line per file might be a header; skip if equal
                    if (firstLineOfThisFile) {
                        List<String> maybeHeader = parseCsvLine(line);
                        firstLineOfThisFile = false;
                        if (maybeHeader.equals(header)) {
                            continue; // skip duplicate header
                        } else {
                            rows.add(toObject(header, maybeHeader));
                            continue;
                        }
                    }

                    // normal data row
                    List<String> cells = parseCsvLine(line);
                    rows.add(toObject(header, cells));
                }
            } catch (IOException ioe) {
                throw new RuntimeException("Failed reading CSV part: " + uri + " (" + ioe.getMessage() + ")", ioe);
            }
        }

        try {
            return MAPPER.writeValueAsBytes(rows);
        } catch (IOException e) {
            throw new RuntimeException("Failed to assemble JSON array from rows: " + e.getMessage(), e);
        }
    }

    /* ===================== Manifest parsing ===================== */

    private static final class ManifestInfo {
        List<String> columns = new ArrayList<>();
        List<Chunk> chunks = new ArrayList<>();
        String compression; // e.g. "gzip"
        long rowCount = -1;
    }
    private static final class Chunk {
        final String uri;
        final Long rows;
        final Long bytes;
        Chunk(String uri, Long rows, Long bytes) { this.uri = uri; this.rows = rows; this.bytes = bytes; }
    }

    private ManifestInfo readManifest(String gsManifestUri) {
        if (gsManifestUri == null || !gsManifestUri.startsWith("gs://")) {
            throw new IllegalArgumentException("Manifest must be a gs:// URI, got: " + gsManifestUri);
        }
        GsLoc loc = splitGs(gsManifestUri);
        String json = readAllUtf8(loc.bucket(), loc.object());

        try {
            JsonNode root = MAPPER.readTree(json);
            ManifestInfo mf = new ManifestInfo();

            JsonNode cols = root.get("columns");
            if (cols != null && cols.isArray()) {
                for (JsonNode c : cols) if (c.isTextual()) mf.columns.add(c.asText());
            }

            JsonNode rc = root.get("row_count");
            if (rc != null && rc.canConvertToLong()) mf.rowCount = rc.asLong();

            JsonNode comp = root.get("compression");
            if (comp != null && comp.isTextual()) mf.compression = comp.asText();

            JsonNode chunks = root.get("chunks");
            if (chunks != null && chunks.isArray()) {
                for (JsonNode ch : chunks) {
                    JsonNode u = ch.get("uri");
                    if (u != null && u.isTextual()) {
                        Long rows = ch.has("rows") && ch.get("rows").canConvertToLong() ? ch.get("rows").asLong() : null;
                        Long bytes = ch.has("bytes") && ch.get("bytes").canConvertToLong() ? ch.get("bytes").asLong() : null;
                        mf.chunks.add(new Chunk(u.asText(), rows, bytes));
                    }
                }
            }
            if (mf.chunks.isEmpty()) {
                JsonNode uris = root.get("uris");
                if (uris != null && uris.isArray()) {
                    for (JsonNode u : uris) if (u.isTextual()) mf.chunks.add(new Chunk(u.asText(), null, null));
                }
            }
            if (mf.chunks.isEmpty()) {
                throw new IllegalStateException("Manifest has no chunk URIs (expected chunks[].uri or uris[]).");
            }

            log.info("Manifest parsed: parts={}, compression={}, columns={}, rowCount={}",
                    mf.chunks.size(), mf.compression, mf.columns.size(), mf.rowCount);
            return mf;

        } catch (RuntimeException re) {
            throw re;
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
            if (!s.isEmpty() && s.charAt(0) == '\uFEFF') s = s.substring(1);
            return s;
        } catch (IOException e) {
            throw new RuntimeException("Failed to read manifest from gs://" + bucket + "/" + object, e);
        }
    }

    /* ===================== CSV helpers ===================== */

    private Map<String, Object> toObject(List<String> header, List<String> cells) {
        Map<String, Object> obj = new LinkedHashMap<>(header.size() * 2);
        for (int i = 0; i < header.size(); i++) {
            String key = header.get(i);
            String val = (i < cells.size()) ? cells.get(i) : "";
            obj.put(key, coerce(val));
        }
        return obj;
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

    /** RFC4180-ish CSV parser (handles quotes, commas, escaped quotes). */
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

    /* ===================== URI helpers ===================== */

    private record GsLoc(String bucket, String object) {}
    private GsLoc splitGs(String gsUri) {
        String noScheme = gsUri.substring("gs://".length());
        int slash = noScheme.indexOf('/');
        if (slash <= 0) throw new IllegalArgumentException("Bad gs uri: " + gsUri);
        return new GsLoc(noScheme.substring(0, slash), noScheme.substring(slash + 1));
    }
}

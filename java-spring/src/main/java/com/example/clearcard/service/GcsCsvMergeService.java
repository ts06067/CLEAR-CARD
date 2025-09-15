package com.example.clearcard.service;

import com.example.clearcard.model.ResultManifest;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.google.cloud.storage.Blob;
import com.google.cloud.storage.BlobId;
import com.google.cloud.storage.Storage;
import org.springframework.http.StreamingHttpOutputMessage;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;

import java.io.BufferedReader;
import java.io.BufferedWriter;
import java.io.InputStreamReader;
import java.io.OutputStreamWriter;
import java.net.URI;
import java.nio.channels.Channels;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.zip.GZIPInputStream;

@Service
public class GcsCsvMergeService {

    private final Storage storage;
    private final ObjectMapper mapper = new ObjectMapper();

    public GcsCsvMergeService(Storage storage) {
        this.storage = storage;
    }

    /** Build a StreamingResponseBody that merges all gzipped CSV parts listed by the manifest. */
    public StreamingResponseBody mergedCsvFromManifestGs(String manifestGsUri) {
        // Parse gs://bucket/object
        GcsPath mp = parseGsUri(manifestGsUri);

        // Read manifest JSON
        Blob manifest = storage.get(BlobId.of(mp.bucket(), mp.object()));
        if (manifest == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Manifest not found in GCS: " + manifestGsUri);
        }

        final ResultManifest rm;
        try {
            var json = new String(storage.readAllBytes(manifest.getBlobId()), StandardCharsets.UTF_8);
            rm = mapper.readValue(json, ResultManifest.class);
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Invalid manifest JSON", e);
        }

        // Validate minimal fields
        if (rm.columns() == null || rm.chunks() == null) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Manifest missing columns/chunks");
        }

        // Build stream
        return output -> {
            try (var writer = new BufferedWriter(new OutputStreamWriter(output, StandardCharsets.UTF_8))) {
                // Single header
                writer.write(csvJoin(rm.columns()));
                writer.write('\n');
                writer.flush();

                // Stream each gzipped part
                for (int i = 0; i < rm.chunks().size(); i++) {
                    var chunk = rm.chunks().get(i);
                    GcsPath cp = parseGsUri(chunk.uri());

                    Blob part = storage.get(BlobId.of(cp.bucket(), cp.object()));
                    if (part == null) continue; // skip missing parts

                    try (var rc = part.reader();
                         var is = Channels.newInputStream(rc);
                         var gis = new GZIPInputStream(is);
                         var br = new BufferedReader(new InputStreamReader(gis, StandardCharsets.UTF_8))) {

                        String line;
                        boolean first = true;
                        while ((line = br.readLine()) != null) {
                            // skip header for parts after the first
                            if (i > 0 && first) { first = false; continue; }
                            writer.write(line);
                            writer.write('\n');
                        }
                        writer.flush();
                    }
                }
            }
        };
    }

    // --- helpers ---

    private static String csvJoin(List<String> cols) {
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < cols.size(); i++) {
            String s = cols.get(i);
            if (s.contains("\"") || s.contains(",") || s.contains("\n") || s.contains("\r")) {
                s = "\"" + s.replace("\"", "\"\"") + "\"";
            }
            sb.append(s);
            if (i < cols.size() - 1) sb.append(',');
        }
        return sb.toString();
    }

    private static GcsPath parseGsUri(String gs) {
        if (gs == null || !gs.startsWith("gs://")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Bad GCS URI: " + gs);
        }
        // Quick parse without java.net.URI quirks
        int slash3 = gs.indexOf('/', 5);
        if (slash3 < 0) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Bad GCS URI: " + gs);
        return new GcsPath(gs.substring(5, slash3), gs.substring(slash3 + 1));
    }

    private record GcsPath(String bucket, String object) {}
}

package com.example.clearcard.service;

import com.fasterxml.jackson.core.JsonEncoding;
import com.fasterxml.jackson.core.JsonGenerator;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.google.cloud.storage.Blob;
import com.google.cloud.storage.BlobId;
import com.google.cloud.storage.Storage;
import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVParser;
import org.apache.commons.csv.CSVRecord;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;

import java.io.*;
import java.nio.channels.Channels;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.zip.GZIPInputStream;

@Service
public class GcsCsvJsonService {

    private final Storage storage;
    private final ObjectMapper mapper = new ObjectMapper();

    public GcsCsvJsonService(Storage storage) {
        this.storage = storage;
    }

    /** Returns StreamingResponseBody that writes a single JSON array of row objects. */
    public StreamingResponseBody jsonArrayFromManifestGs(String manifestGsUri) {
        // Parse gs://bucket/object
        GcsPath mp = parseGsUri(manifestGsUri);

        // Read manifest JSON
        Blob manifest = storage.get(BlobId.of(mp.bucket(), mp.object()));
        if (manifest == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Manifest not found: " + manifestGsUri);
        }
        final Manifest mf = readManifest(manifest);

        // Validate
        if (mf.columns == null || mf.columns.isEmpty() || mf.chunks == null) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Manifest missing columns/chunks");
        }
        final List<String> columns = mf.columns;
        final List<String> chunkUris = new ArrayList<>();
        for (Chunk c : mf.chunks) chunkUris.add(c.uri);

        // Build streaming body
        return output -> {
            JsonGenerator jg = mapper.getFactory().createGenerator(output, JsonEncoding.UTF8);
            jg.writeStartArray();

            for (int i = 0; i < chunkUris.size(); i++) {
                GcsPath cp = parseGsUri(chunkUris.get(i));
                Blob part = storage.get(BlobId.of(cp.bucket(), cp.object()));
                if (part == null) continue;

                try (var rc = part.reader();
                     var is = Channels.newInputStream(rc);
                     var gis = new GZIPInputStream(is);
                     var reader = new InputStreamReader(gis, StandardCharsets.UTF_8)) {

                    // Each part has a header line. We always skip it with skipHeaderRecord(true).
                    CSVFormat fmt = CSVFormat.DEFAULT
                            .builder()
                            .setHeader(columns.toArray(String[]::new))
                            .setSkipHeaderRecord(true)
                            .build();

                    try (CSVParser parser = new CSVParser(reader, fmt)) {
                        for (CSVRecord rec : parser) {
                            jg.writeStartObject();
                            for (String col : columns) {
                                String v = rec.isMapped(col) ? rec.get(col) : "";
                                // Keep as string; you can add type coercion later if needed
                                if (v == null) v = "";
                                jg.writeStringField(col, v);
                            }
                            jg.writeEndObject();
                        }
                    }
                }
                jg.flush(); // push bytes periodically
            }

            jg.writeEndArray();
            jg.flush();
        };
    }

    // ---- helpers ----

    private Manifest readManifest(Blob manifest) {
        try {
            String json = new String(storage.readAllBytes(manifest.getBlobId()), StandardCharsets.UTF_8);
            return mapper.readValue(json, Manifest.class);
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Invalid manifest JSON", e);
        }
    }

    private static GcsPath parseGsUri(String gs) {
        if (gs == null || !gs.startsWith("gs://")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Bad GCS URI: " + gs);
        }
        int slash3 = gs.indexOf('/', 5);
        if (slash3 < 0) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Bad GCS URI: " + gs);
        return new GcsPath(gs.substring(5, slash3), gs.substring(slash3 + 1));
    }

    // Minimal manifest model (matches what the worker writes)
    private static final class Manifest {
        public List<String> columns;
        public long row_count;
        public String format;
        public String compression;
        public List<Chunk> chunks;
    }
    private static final class Chunk { public String uri; public long rows; public long bytes; }

    private record GcsPath(String bucket, String object) {}
}

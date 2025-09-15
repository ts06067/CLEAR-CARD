package com.example.clearcard.model;

import java.util.List;

public record ResultManifest(
        List<String> columns,
        long row_count,
        String format,
        String compression,
        List<Chunk> chunks
) {
    public record Chunk(String uri, long rows, long bytes) {}
}

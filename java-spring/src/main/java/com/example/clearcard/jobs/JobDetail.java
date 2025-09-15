package com.example.clearcard.jobs;
import java.time.Instant;

public record JobDetail(
        String job_id, String state, long row_count, long bytes,
        Instant submitted_at, Instant started_at, Instant completed_at,
        String sql_text, String format, int page_size, long max_rows,
        String gcs_manifest_uri, String error
) {}

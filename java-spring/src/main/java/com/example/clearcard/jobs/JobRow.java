package com.example.clearcard.jobs;
import java.time.Instant;

public record JobRow(
        String job_id, String state, long row_count, long bytes, Instant submitted_at, Instant completed_at
) {}
package com.example.clearcard.dto;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(name = "JobStatusResponse")
public record JobStatusResponse(
        @Schema(example = "RUNNING",
                allowableValues = {"PENDING","RUNNING","SUCCEEDED","FAILED","CANCELLED"}) String state,
        @Schema(example = "100000") long row_count,
        @Schema(example = "52428800") long bytes,
        @Schema(example = "") String error
) {}

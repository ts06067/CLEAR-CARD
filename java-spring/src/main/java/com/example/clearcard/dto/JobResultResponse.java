package com.example.clearcard.dto;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(name = "JobResultResponse")
public record JobResultResponse(
        @Schema(example = "gs://clearcard-sql-results/jobs/<id>/manifest.json") String manifest_gs_uri,
        @Schema(example = "OK", allowableValues = {"OK","ERROR"}) String status,
        @Schema(example = "") String error
) {}

package com.example.clearcard.dto;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(name = "JobSubmitResponse")
public record JobSubmitResponse(
        @Schema(example = "485c6213-0bdb-4d4e-b80b-25180d408c1d") String job_id,
        @Schema(example = "PENDING") String status
) {}

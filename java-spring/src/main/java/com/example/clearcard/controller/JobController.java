package com.example.clearcard.controller;

import com.example.clearcard.dto.*;
import com.example.clearcard.jobs.JobConfigEntity;
import com.example.clearcard.jobs.JobConfigRepository;
import com.example.clearcard.service.*;
import com.example.clearcard.user.UserRepository;

import com.example.clearcard.JobServiceGrpc;
import com.example.clearcard.config.AppProps;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import io.grpc.Channel;
import io.grpc.ClientInterceptor;
import io.grpc.ManagedChannel;
import io.grpc.Metadata;
import io.grpc.ClientInterceptors;
import io.grpc.stub.MetadataUtils;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.enums.ParameterIn;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.ExampleObject;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.constraints.*;

import lombok.extern.slf4j.Slf4j;
import lombok.RequiredArgsConstructor;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;

import java.nio.charset.StandardCharsets;
import java.util.concurrent.TimeUnit;

@Slf4j
@RequiredArgsConstructor
@RestController
@Tag(name = "Jobs", description = "Submit SQL jobs, check status, and download results")
public class JobController {

    private final JobClient jobClient;
    private final GcsCsvMergeService csvMergeService;
    private final GcsCsvJsonService csvJsonService;
    private final AppProps props;
    private final JobConfigRepository configs;     // NEW
    private final UserRepository users;            // NEW
    private final ObjectMapper mapper = new ObjectMapper();

    @Value("${gcs.bucket:clearcard-sql-results}") private String gcsBucket;

    // ---------- SUBMIT: application/json (carries title/config) ----------
    public static record SubmitSqlJobRequest(
            @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String sql,
            @Schema(example = "Yearly mean 2y citations by journal") String title,
            JsonNode tableConfig,
            JsonNode chartConfig
    ) {}

    @Operation(
            summary = "Submit a SQL job (JSON)",
            description = "Queues a read-only SQL job. Accepts `sql`, and optional `title`, `tableConfig`, `chartConfig`. Results are written to GCS as gzipped CSV parts plus a manifest.json."
    )
    @PostMapping(value="/jobs", consumes=MediaType.APPLICATION_JSON_VALUE, produces=MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<JobSubmitResponse> submitJson(@RequestBody SubmitSqlJobRequest body,
                                                        @RequestParam(defaultValue="csv") @Pattern(regexp="csv") String format,
                                                        @RequestParam(defaultValue="5000") @Min(100) @Max(100_000) int pageSize,
                                                        @RequestParam(defaultValue="5000000") @Min(1) long maxRows,
                                                        @RequestHeader(value="X-Request-Id", required=false) String xReqId) {
        if (body == null || body.sql == null || body.sql.isBlank()) {
            return ResponseEntity.badRequest().build();
        }

        // authenticated username → UUID (if available)
        String username = (org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication()!=null)
                ? org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication().getName()
                : "anonymous";

        var ack = jobClient.submit(
                body.sql,
                format,
                pageSize,
                maxRows,
                username,
                xReqId,
                body.title,
                body.tableConfig == null ? null : toJson(body.tableConfig),
                body.chartConfig == null ? null : toJson(body.chartConfig)
        );

        // persist config immediately (best effort)
        try {
            var u = users.findByUsername(username).orElse(null);
            if (u != null) {
                var e = new JobConfigEntity();
                e.setJobId(ack.getJobId());
                e.setUserId(u.getId());
                e.setTitle(body.title);
                e.setSqlText(body.sql);
                e.setTableConfig(body.tableConfig == null ? null : toJson(body.tableConfig));
                e.setChartConfig(body.chartConfig == null ? null : toJson(body.chartConfig));
                configs.save(e);
            }
        } catch (Exception ex) {
            log.warn("failed to persist job config for job {}", ack.getJobId(), ex);
        }

        return ResponseEntity.accepted()
                .location(java.net.URI.create("/jobs/" + ack.getJobId()))
                .body(new JobSubmitResponse(ack.getJobId(), ack.getStatus()));
    }

    private String toJson(JsonNode n) {
        try { return mapper.writeValueAsString(n); } catch (Exception e) { return null; }
    }

    // ---------- SUBMIT: text/plain (backward compatibility) ----------
    @Operation(
            summary = "Submit a SQL job (text/plain)",
            requestBody = @io.swagger.v3.oas.annotations.parameters.RequestBody(
                    required = true,
                    content = @Content(
                            mediaType = "text/plain",
                            schema = @Schema(type = "string"),
                            examples = @ExampleObject(
                                    name = "Simple query",
                                    value = "SELECT TOP (1000) * FROM scopus.dbo.paper;"
                            )
                    )
            ),
            parameters = {
                    @Parameter(name = "format", description = "Output format", example = "csv",
                            schema = @Schema(allowableValues = {"csv"}, defaultValue = "csv")),
                    @Parameter(name = "pageSize", description = "Rows per DB fetch batch",
                            schema = @Schema(type = "integer", minimum = "100", maximum = "100000", defaultValue = "5000")),
                    @Parameter(name = "maxRows", description = "Hard cap on rows processed for the job",
                            schema = @Schema(type = "integer", format = "int64", defaultValue = "5000000")),
                    @Parameter(name = "X-Request-Id", in = ParameterIn.HEADER, required = false,
                            description = "Optional id for end-to-end log correlation")
            }
    )
    @PostMapping(value="/jobs", consumes=MediaType.TEXT_PLAIN_VALUE, produces=MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<JobSubmitResponse> submitText(@RequestBody String sql,
                                                        @RequestParam(defaultValue="csv") @Pattern(regexp="csv") String format,
                                                        @RequestParam(defaultValue="5000") @Min(100) @Max(100_000) int pageSize,
                                                        @RequestParam(defaultValue="5000000") @Min(1) long maxRows,
                                                        @RequestHeader(value="X-Request-Id", required=false) String xReqId) {
        String username = (org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication()!=null)
                ? org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication().getName()
                : "anonymous";

        var ack = jobClient.submit(sql, format, pageSize, maxRows, username, xReqId);
        return ResponseEntity.accepted()
                .location(java.net.URI.create("/jobs/" + ack.getJobId()))
                .body(new JobSubmitResponse(ack.getJobId(), ack.getStatus()));
    }

    // ---------- STATUS ----------
    @Operation(summary = "Get job status", description = "Returns the job state and counters.")
    @GetMapping(value="/jobs/{id}", produces=MediaType.APPLICATION_JSON_VALUE)
    public JobStatusResponse status(@PathVariable("id") String id) {
        var s = jobClient.status(id);
        return new JobStatusResponse(s.getState(), s.getRowCount(), s.getBytes(), s.getErrorMessage());
    }

    // ---------- RESULT POINTER ----------
    @Operation(summary = "Get result manifest pointer",
            description = "Returns the `gs://` URI of the job’s manifest in GCS when the job has succeeded.")
    @GetMapping(value="/jobs/{id}/result", produces=MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<JobResultResponse> result(@PathVariable("id") String id) {
        var ref = jobClient.manifest(id);
        if (!"OK".equals(ref.getStatus())) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body(new JobResultResponse(null, ref.getStatus(), ref.getErrorMessage()));
        }
        return ResponseEntity.ok(new JobResultResponse(ref.getGcsManifestUri(), "OK", ""));
    }

    // ---------- DOWNLOAD CSV ----------
    @Operation(summary = "Download results as a single CSV",
            description = "Streams a merged CSV (UTF-8).")
    @GetMapping(value = "/jobs/{id}/download.csv", produces = "text/csv; charset=UTF-8")
    public ResponseEntity<StreamingResponseBody> downloadCsv(@PathVariable("id") String id) {
        var ref = jobClient.manifest(id);
        if (!"OK".equals(ref.getStatus())) {
            return ResponseEntity.status(409)
                    .body(out -> out.write(("status=" + ref.getStatus() + ", error=" + ref.getErrorMessage())
                            .getBytes(StandardCharsets.UTF_8)));
        }
        StreamingResponseBody body = csvMergeService.mergedCsvFromManifestGs(ref.getGcsManifestUri());
        return ResponseEntity.ok()
                .header("Content-Disposition",
                        "attachment; filename=\"" + props.csv().getFilenamePrefix() + id + ".csv\"")
                .header("Cache-Control", "no-store")
                .body(body);
    }

    // ---------- DOWNLOAD JSON ----------
    @Operation(summary = "Download results as JSON array",
            description = "Streams a JSON array converted on the fly from gzipped CSV parts listed in the manifest.")
    @GetMapping(value = "/jobs/{id}/download.json", produces = "application/json; charset=UTF-8")
    public ResponseEntity<StreamingResponseBody> downloadJson(@PathVariable("id") String id) {
        var ref = jobClient.manifest(id);
        if (!"OK".equals(ref.getStatus())) {
            return ResponseEntity.status(409)
                    .body(out -> out.write(("status=" + ref.getStatus() + ", error=" + ref.getErrorMessage())
                            .getBytes(java.nio.charset.StandardCharsets.UTF_8)));
        }
        StreamingResponseBody body = csvJsonService.jsonArrayFromManifestGs(ref.getGcsManifestUri());
        return ResponseEntity.ok()
                .header("Content-Disposition", "attachment; filename=\"job-" + id + ".json\"")
                .header("Cache-Control", "no-store")
                .body(body);
    }
}

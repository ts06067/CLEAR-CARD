package com.example.clearcard.controller;

import com.example.clearcard.dto.*;
import com.example.clearcard.service.*;

import com.example.clearcard.JobServiceGrpc;

import com.example.clearcard.config.AppProps;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import com.google.cloud.storage.Blob;
import com.google.cloud.storage.BlobId;
import com.google.cloud.storage.Storage;

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

import java.io.BufferedReader;
import java.io.BufferedWriter;
import java.io.InputStreamReader;
import java.io.OutputStreamWriter;
import java.nio.channels.Channels;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.TimeUnit;

import java.util.zip.GZIPInputStream;

@Slf4j
@RequiredArgsConstructor
@RestController
@Tag(name = "Jobs", description = "Submit SQL jobs, check status, and download results")
public class JobController {

    private final Storage storage;
    private final JobClient jobClient;
    private final GcsCsvMergeService csvMergeService;
    private final GcsCsvJsonService csvJsonService;
    private final AppProps props;

    @Value("${grpc.handlerHost}") private String handlerHost;
    @Value("${grpc.handlerPort}") private int handlerPort;
    @Value("${gcs.bucket:clearcard-sql-results}") private String gcsBucket;

    private JobServiceGrpc.JobServiceBlockingStub stubWithHeaders(ManagedChannel ch, String requestId) {
        Metadata h = new Metadata();
        h.put(Metadata.Key.of("x-request-id", Metadata.ASCII_STRING_MARSHALLER), requestId);
        ClientInterceptor it = MetadataUtils.newAttachHeadersInterceptor(h);
        Channel intercepted = ClientInterceptors.intercept(ch, it);
        return JobServiceGrpc.newBlockingStub(intercepted)
                .withDeadlineAfter(2, TimeUnit.MINUTES);
    }

    @Operation(
            summary = "Submit a SQL job",
            description = "Queues a long-running, read-only SQL job. Results are written to GCS as gzipped CSV parts plus a manifest.json.",
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
            },
            responses = {
                    @ApiResponse(responseCode = "200", description = "Queued",
                            content = @Content(schema = @Schema(implementation = JobSubmitResponse.class))),
                    @ApiResponse(responseCode = "400", description = "Invalid input"),
                    @ApiResponse(responseCode = "500", description = "Server error")
            }
    )

    @Validated
    @PostMapping(value="/jobs", consumes=MediaType.TEXT_PLAIN_VALUE, produces=MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<JobSubmitResponse> submit(@RequestBody String sql,
                                                    @RequestParam(defaultValue="csv") @Pattern(regexp="csv") String format,
                                                    @RequestParam(defaultValue="5000") @Min(100) @Max(100_000) int pageSize,
                                                    @RequestParam(defaultValue="5000000") @Min(1) long maxRows,
                                                    @RequestHeader(value="X-Request-Id", required=false) String xReqId,
                                                    HttpServletRequest req) {
        var ack = jobClient.submit(sql, format, pageSize, maxRows, /*userId*/ "user-1", xReqId);
        return ResponseEntity.accepted()
                .location(java.net.URI.create("/jobs/" + ack.getJobId()))
                .body(new JobSubmitResponse(ack.getJobId(), ack.getStatus()));
    }

    @Operation(
            summary = "Get job status",
            description = "Returns the job state and counters.",
            responses = {
                    @ApiResponse(responseCode = "200", description = "Current status",
                            content = @Content(schema = @Schema(implementation = JobStatusResponse.class))),
                    @ApiResponse(responseCode = "404", description = "Job not found"),
                    @ApiResponse(responseCode = "500", description = "Server error")
            }
    )
    @GetMapping(value="/jobs/{id}", produces=MediaType.APPLICATION_JSON_VALUE)
    public JobStatusResponse status(@PathVariable("id") String id) {
        var s = jobClient.status(id);
        return new JobStatusResponse(s.getState(), s.getRowCount(), s.getBytes(), s.getErrorMessage());
    }

    @Operation(
            summary = "Get result manifest pointer",
            description = "Returns the `gs://` URI of the job’s manifest in GCS when the job has succeeded.",
            responses = {
                    @ApiResponse(responseCode = "200", description = "Result manifest pointer",
                            content = @Content(schema = @Schema(implementation = JobResultResponse.class))),
                    @ApiResponse(responseCode = "409", description = "Job not in SUCCEEDED state"),
                    @ApiResponse(responseCode = "404", description = "Job not found")
            }
    )
    @GetMapping(value="/jobs/{id}/result", produces=MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<JobResultResponse> result(@PathVariable("id") String id) {
        var ref = jobClient.manifest(id);
        if (!"OK".equals(ref.getStatus())) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body(new JobResultResponse(null, ref.getStatus(), ref.getErrorMessage()));
        }
        return ResponseEntity.ok(new JobResultResponse(ref.getGcsManifestUri(), "OK", ""));
    }

    @Operation(
            summary = "Download results as a single CSV",
            description = "Streams a merged CSV (UTF-8). Reads the manifest from GCS and concatenates all gzipped CSV parts, keeping a single header row.",
            responses = {
                    @ApiResponse(responseCode = "200", description = "CSV stream", content = @Content(mediaType = "text/csv")),
                    @ApiResponse(responseCode = "404", description = "Manifest or parts not found"),
                    @ApiResponse(responseCode = "409", description = "Job not in SUCCEEDED state")
            }
    )
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

    @Operation(
            summary = "Download results as JSON array",
            description = "Streams a single JSON array of row objects. Converts gzipped CSV parts listed in the manifest to JSON on the fly.",
            responses = {
                    @ApiResponse(responseCode = "200", description = "JSON stream", content = @Content(mediaType = "application/json")),
                    @ApiResponse(responseCode = "404", description = "Manifest or parts not found"),
                    @ApiResponse(responseCode = "409", description = "Job not in SUCCEEDED state")
            }
    )
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

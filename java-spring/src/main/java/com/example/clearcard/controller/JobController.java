package com.example.clearcard.controller;

import com.example.clearcard.dto.JobResultResponse;
import com.example.clearcard.dto.JobStatusResponse;
import com.example.clearcard.dto.JobSubmitResponse;
import com.example.clearcard.jobs.JobConfigEntity;
import com.example.clearcard.jobs.JobConfigRepository;
import com.example.clearcard.service.GcsCsvJsonService;
import com.example.clearcard.service.GcsCsvMergeService;
import com.example.clearcard.service.JobClient;
import com.example.clearcard.user.UserRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.enums.ParameterIn;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.ExampleObject;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Pattern;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;

import java.util.Locale;

@Slf4j
@RequiredArgsConstructor
@RestController
@Tag(name = "Jobs", description = "Submit SQL jobs, check status, and download results")
public class JobController {

    private final JobClient jobClient;
    private final GcsCsvMergeService csvMergeService;
    private final GcsCsvJsonService csvJsonService;
    private final JobConfigRepository configs;
    private final UserRepository users;

    private final ObjectMapper mapper = new ObjectMapper();

    // simple filename prefix (configurable)
    @Value("${download.filenamePrefix:job-}")
    private String filenamePrefix;

    /* -------------------- Helpers -------------------- */

    /** Normalize incoming job ids so storage lookups hit the right GCS path. */
    private static String normId(String id) {
        return id == null ? null : id.toLowerCase(Locale.ROOT);
    }

    private String toJson(JsonNode n) {
        try { return mapper.writeValueAsString(n); } catch (Exception e) { return null; }
    }

    /* -------------------- Submit (JSON) -------------------- */

    public static record SubmitSqlJobRequest(
            @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String sql,
            @Schema(example = "Yearly mean 2y citations by journal") String title,
            JsonNode tableConfig,
            JsonNode chartConfig
    ) {}

    @Operation(
            summary = "Submit a SQL job (JSON)",
            description = "Queues a read-only SQL job. Accepts `sql`, and optional `title`, `tableConfig`, `chartConfig`."
    )
    @PostMapping(value="/jobs", consumes=MediaType.APPLICATION_JSON_VALUE, produces=MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<JobSubmitResponse> submitJson(@RequestBody SubmitSqlJobRequest body,
                                                        @RequestParam(defaultValue="csv") @Pattern(regexp="csv") String format,
                                                        @RequestParam(defaultValue="5000") @Min(100) @Max(100_000) int pageSize,
                                                        @RequestParam(defaultValue="5000000") @Min(1) long maxRows,
                                                        @RequestHeader(value="X-Request-Id", required=false) String xReqId,
                                                        Authentication auth) {
        if (body == null || body.sql == null || body.sql.isBlank()) {
            return ResponseEntity.badRequest().build();
        }
        String username = (auth != null && auth.getName() != null) ? auth.getName() : "anonymous";

        var ack = jobClient.submit(
                body.sql, format, pageSize, maxRows, username, xReqId,
                body.title,
                body.tableConfig == null ? null : toJson(body.tableConfig),
                body.chartConfig == null ? null : toJson(body.chartConfig)
        );

        // best-effort: persist configs
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
            log.warn("Failed to persist job config for job {}", ack.getJobId(), ex);
        }

        return ResponseEntity.accepted()
                .location(java.net.URI.create("/jobs/" + ack.getJobId()))
                .body(new JobSubmitResponse(ack.getJobId(), ack.getStatus()));
    }

    /* -------------------- Submit (text/plain, back-compat) -------------------- */

    @Operation(
            summary = "Submit a SQL job (text/plain)",
            requestBody = @io.swagger.v3.oas.annotations.parameters.RequestBody(
                    required = true,
                    content = @Content(
                            mediaType = "text/plain",
                            schema = @Schema(type = "string"),
                            examples = @ExampleObject(name = "Simple query", value = "SELECT TOP (1000) * FROM scopus.dbo.paper;")
                    )
            ),
            parameters = {
                    @Parameter(name = "format", description = "Output format", example = "csv",
                            schema = @Schema(allowableValues = {"csv"}, defaultValue = "csv")),
                    @Parameter(name = "pageSize", description = "Rows per DB fetch batch",
                            schema = @Schema(type = "integer", minimum = "100", maximum = "100000", defaultValue = "5000")),
                    @Parameter(name = "maxRows", description = "Hard cap on rows processed for the job",
                            schema = @Schema(type = "integer", format = "int64", defaultValue = "5000000")),
                    @Parameter(name = "X-Request-Id", in = ParameterIn.HEADER, required = false, description = "Optional id for log correlation")
            }
    )
    @PostMapping(value="/jobs", consumes=MediaType.TEXT_PLAIN_VALUE, produces=MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<JobSubmitResponse> submitText(@RequestBody String sql,
                                                        @RequestParam(defaultValue="csv") @Pattern(regexp="csv") String format,
                                                        @RequestParam(defaultValue="5000") @Min(100) @Max(100_000) int pageSize,
                                                        @RequestParam(defaultValue="5000000") @Min(1) long maxRows,
                                                        @RequestHeader(value="X-Request-Id", required=false) String xReqId,
                                                        Authentication auth) {
        String username = (auth != null && auth.getName() != null) ? auth.getName() : "anonymous";
        var ack = jobClient.submit(sql, format, pageSize, maxRows, username, xReqId);
        return ResponseEntity.accepted()
                .location(java.net.URI.create("/jobs/" + ack.getJobId()))
                .body(new JobSubmitResponse(ack.getJobId(), ack.getStatus()));
    }

    /* -------------------- Status / Result pointer -------------------- */

    @Operation(summary = "Get job status")
    @GetMapping(value="/jobs/{id}", produces=MediaType.APPLICATION_JSON_VALUE)
    public JobStatusResponse status(@PathVariable("id") String id) {
        var s = jobClient.status(normId(id)); // 🔽 normalize to lower-case
        return new JobStatusResponse(s.getState(), s.getRowCount(), s.getBytes(), s.getErrorMessage());
    }

    @Operation(summary = "Get result manifest pointer")
    @GetMapping(value="/jobs/{id}/result", produces=MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<JobResultResponse> result(@PathVariable("id") String id) {
        var ref = jobClient.manifest(normId(id)); // 🔽 normalize to lower-case
        if (!"OK".equals(ref.getStatus())) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body(new JobResultResponse(null, ref.getStatus(), ref.getErrorMessage()));
        }
        return ResponseEntity.ok(new JobResultResponse(ref.getGcsManifestUri(), "OK", ""));
    }

    /* -------------------- Downloads -------------------- */

    @Operation(summary = "Download results as a single CSV")
    @GetMapping(value = "/jobs/{id}/download.csv", produces = "text/csv; charset=UTF-8")
    public ResponseEntity<StreamingResponseBody> downloadCsv(@PathVariable("id") String id) {
        var ref = jobClient.manifest(normId(id)); // 🔽 normalize to lower-case
        if (!"OK".equals(ref.getStatus())) {
            return conflictCsv(ref);
        }
        StreamingResponseBody body = csvMergeService.mergedCsvFromManifestGs(ref.getGcsManifestUri());
        // keep the user-facing filename using the incoming id (may be upper-case)
        return ResponseEntity.ok()
                .header("Content-Disposition", "attachment; filename=\"" + filenamePrefix + id + ".csv\"")
                .header("Cache-Control", "no-store")
                .body(body);
    }

    @Operation(summary = "Download results as JSON array")
    @GetMapping(value = "/jobs/{id}/download.json", produces = "application/json; charset=UTF-8")
    public ResponseEntity<?> downloadJson(@PathVariable("id") String id) {
        final String nid = normId(id); // 🔽 normalize to lower-case
        try {
            var ref = jobClient.manifest(nid);
            if (!"OK".equals(ref.getStatus())) {
                return ResponseEntity.status(HttpStatus.CONFLICT)
                        .contentType(MediaType.APPLICATION_JSON)
                        .body(java.util.Map.of(
                                "status", 409,
                                "error", ref.getErrorMessage() == null ? ref.getStatus() : ref.getErrorMessage()
                        ));
            }
            StreamingResponseBody body = csvJsonService.jsonArrayFromManifestGs(ref.getGcsManifestUri());
            return ResponseEntity.ok()
                    .header("Cache-Control", "no-store")
                    .body(body);
        } catch (ResponseStatusException rse) {
            HttpStatus st = HttpStatus.valueOf(rse.getStatusCode().value());
            return ResponseEntity.status(st)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(java.util.Map.of(
                            "status", st.value(),
                            "error", rse.getReason() == null ? "Failed to stream result" : rse.getReason()
                    ));
        } catch (Exception ex) {
            log.error("download.json failed for {}", nid, ex);
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(java.util.Map.of(
                            "status", 409,
                            "error", "Result not ready or unavailable"
                    ));
        }
    }

    private ResponseEntity<StreamingResponseBody> conflictCsv(com.example.clearcard.ResultManifestRef ref) {
        StreamingResponseBody errBody = out -> {
            String msg = "status=" + ref.getStatus() + ", error=" + ref.getErrorMessage();
            out.write(msg.getBytes(java.nio.charset.StandardCharsets.UTF_8));
        };
        return ResponseEntity.status(HttpStatus.CONFLICT).body(errBody);
    }
}

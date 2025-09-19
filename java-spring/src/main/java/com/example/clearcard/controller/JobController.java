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
import io.swagger.v3.oas.annotations.media.Schema;
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
@RequestMapping({ "", "/api" }) // <-- serve both /jobs/** and /api/jobs/**
public class JobController {

    private final JobClient jobClient;
    private final GcsCsvMergeService csvMergeService;
    private final GcsCsvJsonService csvJsonService;
    private final JobConfigRepository configs;
    private final UserRepository users;

    private final ObjectMapper mapper = new ObjectMapper();

    @Value("${download.filenamePrefix:job-}")
    private String filenamePrefix;

    private static String normId(String id) {
        return id == null ? null : id.toLowerCase(Locale.ROOT);
    }
    private String toJson(JsonNode n) {
        try { return mapper.writeValueAsString(n); } catch (Exception e) { return null; }
    }

    /* -------------------- Unified Submit (JSON or text/plain) -------------------- */

    public static record SubmitSqlJobRequest(
            @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String sql,
            @Schema(example = "Yearly mean 2y citations by journal") String title,
            JsonNode tableConfig,
            JsonNode chartConfig
    ) {}

    @Operation(summary = "Submit a SQL job (JSON or text/plain)")
    @PostMapping(
            value = "/jobs",
            consumes = { MediaType.APPLICATION_JSON_VALUE, MediaType.TEXT_PLAIN_VALUE },
            produces = MediaType.APPLICATION_JSON_VALUE
    )
    public ResponseEntity<JobSubmitResponse> submitUnified(
            @RequestBody String body,
            @RequestParam(defaultValue="csv") @Pattern(regexp="csv") String format,
            @RequestParam(defaultValue="5000") @Min(100) @Max(100_000) int pageSize,
            @RequestParam(defaultValue="5000000") @Min(1) long maxRows,
            @RequestHeader(value="X-Request-Id", required=false) String xReqId,
            @RequestHeader(value="Content-Type") String contentType,
            @RequestHeader(value="X-Job-Title", required=false) String xTitle,
            @RequestHeader(value="X-Job-Config", required=false) String xConfig,
            Authentication auth
    ) {
        final String username = (auth != null && auth.getName() != null) ? auth.getName() : "anonymous";
        log.info("POST /jobs by user={} format={} pageSize={} maxRows={}", username, format, pageSize, maxRows);

        String sql;
        String title = null;
        String tableConfigJson = null;
        String chartConfigJson = null;

        try {
            if (contentType != null && contentType.toLowerCase().startsWith(MediaType.APPLICATION_JSON_VALUE)) {
                SubmitSqlJobRequest req = mapper.readValue(body, SubmitSqlJobRequest.class);
                if (req == null || req.sql() == null || req.sql().isBlank()) {
                    return ResponseEntity.badRequest().build();
                }
                sql = req.sql();
                title = req.title();
                tableConfigJson = req.tableConfig() == null ? null : toJson(req.tableConfig());
                chartConfigJson = req.chartConfig() == null ? null : toJson(req.chartConfig());
            } else {
                sql = body;
                if (sql == null || sql.isBlank()) return ResponseEntity.badRequest().build();
                title = xTitle;

                if (xConfig != null && !xConfig.isBlank()) {
                    try {
                        JsonNode node = mapper.readTree(xConfig);
                        JsonNode qb  = node.get("qb");
                        JsonNode cfg = node.get("cfg");
                        if (qb  != null && !qb.isNull())  tableConfigJson = mapper.writeValueAsString(qb);
                        if (cfg != null && !cfg.isNull()) chartConfigJson = mapper.writeValueAsString(cfg);
                    } catch (Exception e) {
                        tableConfigJson = xConfig; // store raw
                    }
                }
            }
        } catch (Exception parseEx) {
            log.warn("Invalid /jobs payload: {}", parseEx.getMessage());
            return ResponseEntity.badRequest().build();
        }

        var ack = jobClient.submit(sql, format, pageSize, maxRows, username, xReqId, title, tableConfigJson, chartConfigJson);

        try {
            var u = users.findByUsername(username).orElse(null);
            if (u != null) {
                var e = new JobConfigEntity();
                e.setJobId(ack.getJobId());
                e.setUserId(u.getId());
                e.setTitle(title);
                e.setSqlText(sql);
                e.setTableConfig(tableConfigJson);
                e.setChartConfig(chartConfigJson);
                configs.save(e);
            }
        } catch (Exception ex) {
            log.warn("Failed to persist job config for job {}", ack.getJobId(), ex);
        }

        return ResponseEntity.accepted()
                .location(java.net.URI.create("/jobs/" + ack.getJobId()))
                .body(new JobSubmitResponse(ack.getJobId(), ack.getStatus()));
    }

    /* -------------------- Status / Result pointer -------------------- */

    @GetMapping(value="/jobs/{id}", produces=MediaType.APPLICATION_JSON_VALUE)
    public JobStatusResponse status(@PathVariable("id") String id) {
        var s = jobClient.status(normId(id));
        return new JobStatusResponse(s.getState(), s.getRowCount(), s.getBytes(), s.getErrorMessage());
    }

    @GetMapping(value="/jobs/{id}/result", produces=MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<JobResultResponse> result(@PathVariable("id") String id) {
        var ref = jobClient.manifest(normId(id));
        if (!"OK".equals(ref.getStatus())) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body(new JobResultResponse(null, ref.getStatus(), ref.getErrorMessage()));
        }
        return ResponseEntity.ok(new JobResultResponse(ref.getGcsManifestUri(), "OK", ""));
    }

    /* -------------------- Downloads -------------------- */

    @GetMapping(value = "/jobs/{id}/download.csv", produces = "text/csv; charset=UTF-8")
    public ResponseEntity<StreamingResponseBody> downloadCsv(@PathVariable("id") String id) {
        var ref = jobClient.manifest(id);
        log.info("downloadCsv for job {}: {}", id, ref.getStatus());
        if (!"OK".equals(ref.getStatus())) {
            return conflictCsv(ref);
        }
        StreamingResponseBody body = csvMergeService.mergedCsvFromManifestGs(ref.getGcsManifestUri());
        return ResponseEntity.ok()
                .header("Content-Disposition", "attachment; filename=\"" + filenamePrefix + id + ".csv\"")
                .header("Cache-Control", "no-store")
                .body(body);
    }

    @GetMapping(value = "/jobs/{id}/download.json", produces = "application/json; charset=UTF-8")
    public ResponseEntity<?> downloadJson(@PathVariable("id") String id) {
        final String nid = normId(id);
        try {
            var ref = jobClient.manifest(nid);
            log.info("downloadJson for job {}: {}", nid, ref.getStatus());
            if (!"OK".equals(ref.getStatus())) {
                log.info("OK status but error:");
                return ResponseEntity.status(HttpStatus.CONFLICT)
                        .contentType(MediaType.APPLICATION_JSON)
                        .body(java.util.Map.of(
                                "status", 409,
                                "error", ref.getErrorMessage() == null ? ref.getStatus() : ref.getErrorMessage()
                        ));
            }
            log.info("jsonArrayFromManifestGs");
            StreamingResponseBody body = csvJsonService.jsonArrayFromManifestGs(ref.getGcsManifestUri());
            log.info("downloadJson success");
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

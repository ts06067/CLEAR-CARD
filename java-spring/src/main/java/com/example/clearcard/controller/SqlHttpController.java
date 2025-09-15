package com.example.clearcard.controller;

import com.example.clearcard.SqlChunk;
import com.example.clearcard.SqlControllerGrpc;
import com.example.clearcard.SqlRequest;
import io.grpc.Channel;
import io.grpc.ClientInterceptor;
import io.grpc.ManagedChannel;
import io.grpc.ManagedChannelBuilder;
import io.grpc.Metadata;
import io.grpc.StatusRuntimeException;
import io.grpc.stub.MetadataUtils;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;
import java.util.concurrent.TimeUnit;

@RestController
public class SqlHttpController {

    private static final Logger log = LoggerFactory.getLogger(SqlHttpController.class);

    @Value("${grpc.handlerHost}")
    private String handlerHost;

    @Value("${grpc.handlerPort}")
    private int handlerPort;

    /** JSON response shape */
    public static class TableJson {
        public List<String> columns = new ArrayList<>();
        public List<List<String>> rows = new ArrayList<>();
        public String status = "OK";
        public String error = "";
        public boolean truncated = false;
    }

    /**
     * POST /sql
     * Body: raw SQL (text/plain)
     * Query params:
     *   - pageSize (default 500): number of rows per gRPC chunk fetched from Python
     *   - maxRows  (default 5000): cap rows returned to client (for safety)
     */
    @PostMapping(value = "/sql", consumes = MediaType.TEXT_PLAIN_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<TableJson> runSql(@RequestBody String sql,
                                            @RequestParam(value = "pageSize", required = false, defaultValue = "500") int pageSize,
                                            @RequestParam(value = "maxRows", required = false, defaultValue = "5000") int maxRows,
                                            @RequestHeader(value = "X-Request-Id", required = false) String xReqId,
                                            HttpServletRequest httpReq) {

        final String requestId = (xReqId != null && !xReqId.isBlank()) ? xReqId : UUID.randomUUID().toString();
        final String client = Optional.ofNullable(httpReq.getHeader("X-Forwarded-For"))
                .orElseGet(httpReq::getRemoteAddr);

        final long t0 = System.nanoTime();
        log.info("HTTP /sql start request_id={} client={} pageSize={} maxRows={}", requestId, client, pageSize, maxRows);

        // Build a Netty-based channel (no OkHttp)
        ManagedChannel base = ManagedChannelBuilder
                .forAddress(handlerHost, handlerPort)
                .usePlaintext() // TODO: enable TLS for production
                .build();

        TableJson out = new TableJson();

        try {
            // Attach x-request-id via interceptor
            Metadata headers = new Metadata();
            Metadata.Key<String> X_REQUEST_ID = Metadata.Key.of("x-request-id", Metadata.ASCII_STRING_MARSHALLER);
            headers.put(X_REQUEST_ID, requestId);
            ClientInterceptor hdrInt = MetadataUtils.newAttachHeadersInterceptor(headers);
            Channel intercepted = io.grpc.ClientInterceptors.intercept(base, hdrInt);

            SqlControllerGrpc.SqlControllerBlockingStub stub =
                    SqlControllerGrpc.newBlockingStub(intercepted)
                            .withDeadlineAfter(5, TimeUnit.MINUTES);

            SqlRequest req = SqlRequest.newBuilder()
                    .setSql(sql == null ? "" : sql)
                    .setPageSize(pageSize)
                    .setRequestId(requestId)
                    .build();

            int rows = 0;
            boolean haveColumns = false;

            Iterator<SqlChunk> it = stub.run(req);
            while (it.hasNext()) {
                SqlChunk chunk = it.next();

                // Capture schema once (avoid hasSchema() portability issues)
                if (!haveColumns && chunk.getSchema().getColumnsCount() > 0) {
                    out.columns = new ArrayList<>(chunk.getSchema().getColumnsList());
                    haveColumns = true;
                }

                if (!"OK".equals(chunk.getStatus())) {
                    out.status = chunk.getStatus();
                    out.error = chunk.getErrorMessage();
                    long totalMs = (System.nanoTime() - t0) / 1_000_000;
                    log.warn("HTTP /sql upstream_error request_id={} total_latency_ms={} status={} err={}",
                            requestId, totalMs, out.status, out.error);
                    return ResponseEntity.status(502).body(out);
                }

                for (var row : chunk.getRowsList()) {
                    if (rows >= maxRows) {
                        out.truncated = true;
                        long totalMs = (System.nanoTime() - t0) / 1_000_000;
                        log.warn("HTTP /sql truncated request_id={} total_latency_ms={} rows={}",
                                requestId, totalMs, rows);
                        return ResponseEntity.ok(out);
                    }
                    out.rows.add(new ArrayList<>(row.getCellsList()));
                    rows++;
                }

                if (chunk.getLast()) break;
            }

            long totalMs = (System.nanoTime() - t0) / 1_000_000;
            log.info("HTTP /sql success request_id={} total_latency_ms={} rows={}",
                    requestId, totalMs, out.rows.size());
            return ResponseEntity.ok(out);

        } catch (StatusRuntimeException e) {
            long totalMs = (System.nanoTime() - t0) / 1_000_000;
            out.status = "ERROR";
            out.error = "gRPC: " + e.getStatus().getCode() + " - " + e.getStatus().getDescription();
            log.error("HTTP /sql grpc_error request_id={} code={} desc={} total_latency_ms={}",
                    requestId, e.getStatus().getCode(), e.getStatus().getDescription(), totalMs);
            return ResponseEntity.status(502).body(out);

        } catch (Exception e) {
            long totalMs = (System.nanoTime() - t0) / 1_000_000;
            out.status = "ERROR";
            out.error = e.toString();
            log.error("HTTP /sql exception request_id={} ex={} total_latency_ms={}", requestId, e.toString(), totalMs);
            return ResponseEntity.status(500).body(out);

        } finally {
            base.shutdownNow();
        }
    }
}

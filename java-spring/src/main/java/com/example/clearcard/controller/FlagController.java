package com.example.clearcard.controller;

import com.example.clearcard.ControllerRequest;
import com.example.clearcard.ControllerResponse;
import com.example.clearcard.FlagControllerGrpc;
import io.grpc.ManagedChannel;
import io.grpc.ManagedChannelBuilder;
import io.grpc.Metadata;
import io.grpc.StatusRuntimeException;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

@RestController
public class FlagController {

    private static final Logger log = LoggerFactory.getLogger(FlagController.class);

    @Value("${grpc.handlerHost}")
    private String handlerHost;

    @Value("${grpc.handlerPort}")
    private int handlerPort;

    // GET /flag?value=<integer>
    @GetMapping("/flag")
    public ResponseEntity<String> setFlagQuery(@RequestParam("value") String valueRaw,
                                               @RequestHeader(value = "X-Request-Id", required = false) String xReqId,
                                               HttpServletRequest httpReq) {
        return setFlagInternal(valueRaw, xReqId, httpReq);
    }

    // GET /flag/<integer>
    @GetMapping("/flag/{value}")
    public ResponseEntity<String> setFlagPath(@PathVariable("value") String valueRaw,
                                              @RequestHeader(value = "X-Request-Id", required = false) String xReqId,
                                              HttpServletRequest httpReq) {
        return setFlagInternal(valueRaw, xReqId, httpReq);
    }

    private ResponseEntity<String> setFlagInternal(String valueRaw, String xReqId, HttpServletRequest httpReq) {
        final String requestId = Optional.ofNullable(xReqId).filter(s -> !s.isBlank())
                .orElse(UUID.randomUUID().toString());
        final String client = Optional.ofNullable(httpReq.getHeader("X-Forwarded-For"))
                .orElseGet(httpReq::getRemoteAddr);

        final long t0 = System.nanoTime();
        log.info("HTTP in start request_id={} path={} client={} value_raw={}",
                requestId, httpReq.getRequestURI(), client, valueRaw);

        // Parse to int32 (proto uses int32)
        final int value;
        try {
            long parsed = Long.parseLong(valueRaw.trim());
            if (parsed < Integer.MIN_VALUE || parsed > Integer.MAX_VALUE) {
                log.warn("HTTP in bad_request request_id={} reason=int32_out_of_range parsed={}", requestId, parsed);
                return ResponseEntity.badRequest().body("Invalid value: must fit 32-bit integer.");
            }
            value = (int) parsed;
        } catch (NumberFormatException e) {
            log.warn("HTTP in bad_request request_id={} reason=not_an_integer raw={}", requestId, valueRaw);
            return ResponseEntity.badRequest().body("Invalid value: must be an integer.");
        }

        ManagedChannel channel = ManagedChannelBuilder
                .forAddress(handlerHost, handlerPort)
                .usePlaintext() // TODO: enable TLS for prod
                .build();

        try {
            // gRPC stub + metadata (propagate request_id)
            // build headers
            Metadata headers = new Metadata();
            Metadata.Key<String> X_REQUEST_ID =
                    Metadata.Key.of("x-request-id", Metadata.ASCII_STRING_MARSHALLER);
            headers.put(X_REQUEST_ID, requestId);

            // build stub with interceptor that attaches headers
            FlagControllerGrpc.FlagControllerBlockingStub stub =
                    FlagControllerGrpc.newBlockingStub(channel)
                            .withInterceptors(io.grpc.stub.MetadataUtils.newAttachHeadersInterceptor(headers))
                            .withDeadlineAfter(1, TimeUnit.SECONDS);

            ControllerRequest req = ControllerRequest.newBuilder()
                    .setTargetValue(value)
                    .setRequestId(requestId)
                    .build();

            long dsStart = System.nanoTime();
            ControllerResponse resp = stub.setAndRead(req);
            long dsMs = (System.nanoTime() - dsStart) / 1_000_000;

            log.info("gRPC ok request_id={} target={} latency_ms={} status={} value={}",
                    requestId, handlerHost + ":" + handlerPort, dsMs, resp.getStatus(), resp.getValue());

            if (!"OK".equals(resp.getStatus())) {
                long totalMs = (System.nanoTime() - t0) / 1_000_000;
                log.warn("HTTP out upstream_error request_id={} total_latency_ms={} status={} err={}",
                        requestId, totalMs, resp.getStatus(), resp.getErrorMessage());
                return ResponseEntity.status(502).body("0");
            }

            long totalMs = (System.nanoTime() - t0) / 1_000_000;
            log.info("HTTP out success request_id={} total_latency_ms={} return_value={}",
                    requestId, totalMs, resp.getValue());

            // Return the source-of-truth value from Python app
            return ResponseEntity.ok(String.valueOf(resp.getValue()));

        } catch (StatusRuntimeException e) {
            long totalMs = (System.nanoTime() - t0) / 1_000_000;
            log.error("gRPC error request_id={} code={} desc={} total_latency_ms={}",
                    requestId, e.getStatus().getCode(), e.getStatus().getDescription(), totalMs);
            return ResponseEntity.status(504).body("0"); // timeout/unavailable/etc.
        } catch (Exception e) {
            long totalMs = (System.nanoTime() - t0) / 1_000_000;
            log.error("HTTP out exception request_id={} ex={} total_latency_ms={}",
                    requestId, e.toString(), totalMs);
            return ResponseEntity.status(500).body("0");
        } finally {
            channel.shutdownNow();
        }
    }
}

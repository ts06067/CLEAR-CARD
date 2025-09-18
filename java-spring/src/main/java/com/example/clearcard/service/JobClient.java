package com.example.clearcard.service;

import com.example.clearcard.*;
import io.grpc.*;
import io.grpc.stub.MetadataUtils;
import org.springframework.stereotype.Service;

import java.util.UUID;
import java.util.concurrent.TimeUnit;

@Service
public class JobClient {

    private final JobServiceGrpc.JobServiceBlockingStub base;

    public JobClient(JobServiceGrpc.JobServiceBlockingStub base) {
        this.base = base;
    }

    private JobServiceGrpc.JobServiceBlockingStub withHeadersAndDeadline(String requestId, long deadlineMin) {
        String rid = (requestId == null || requestId.isBlank()) ? UUID.randomUUID().toString() : requestId;
        Metadata h = new Metadata();
        h.put(Metadata.Key.of("x-request-id", Metadata.ASCII_STRING_MARSHALLER), rid);

        ClientInterceptor it = MetadataUtils.newAttachHeadersInterceptor(h);
        Channel intercepted = ClientInterceptors.intercept(base.getChannel(), it);
        return JobServiceGrpc.newBlockingStub(intercepted).withDeadlineAfter(deadlineMin, TimeUnit.MINUTES);
    }

    // Back-compat: existing submit without title/config
    public JobAck submit(String sql, String format, int pageSize, long maxRows,
                         String userId, String requestId) {
        return submit(sql, format, pageSize, maxRows, userId, requestId, null, null, null);
    }

    // NEW: submit with title + configs
    public JobAck submit(String sql, String format, int pageSize, long maxRows,
                         String userId, String requestId,
                         String title, String tableConfigJson, String chartConfigJson) {
        SqlJobOptions opts = SqlJobOptions.newBuilder()
                .setFormat(format == null ? "csv" : format)
                .setPageSize(pageSize)
                .setMaxRows(maxRows)
                .build();

        SubmitJobRequest.Builder b = SubmitJobRequest.newBuilder()
                .setSql(sql == null ? "" : sql)
                .setOptions(opts)
                .setUserId(userId == null ? "anonymous" : userId)
                .setRequestId(requestId == null ? "" : requestId);

        if (title != null) b.setTitle(title);
        if (tableConfigJson != null) b.setTableConfigJson(tableConfigJson);
        if (chartConfigJson != null) b.setChartConfigJson(chartConfigJson);

        return withHeadersAndDeadline(requestId, 2).submit(b.build());
    }

    public JobStatus status(String jobId) {
        return base.withDeadlineAfter(2, TimeUnit.MINUTES)
                .getStatus(JobId.newBuilder().setJobId(jobId).build());
    }

    public ResultManifestRef manifest(String jobId) {
        return base.withDeadlineAfter(2, TimeUnit.MINUTES)
                .getResultManifest(JobId.newBuilder().setJobId(jobId).build());
    }

    public JobStatus cancel(String jobId, String requestId) {
        return withHeadersAndDeadline(requestId, 2)
                .cancel(JobId.newBuilder().setJobId(jobId).build());
    }
}

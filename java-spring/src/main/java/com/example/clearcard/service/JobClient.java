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

    private JobServiceGrpc.JobServiceBlockingStub withHeadersAndDeadline(String requestId, long deadlineSec) {
        String rid = (requestId == null || requestId.isBlank()) ? UUID.randomUUID().toString() : requestId;
        Metadata h = new Metadata();
        h.put(Metadata.Key.of("x-request-id", Metadata.ASCII_STRING_MARSHALLER), rid);

        // attach metadata to the base stub's channel for this call only
        ClientInterceptor it = MetadataUtils.newAttachHeadersInterceptor(h);
        Channel intercepted = ClientInterceptors.intercept(base.getChannel(), it);

        return JobServiceGrpc.newBlockingStub(intercepted).withDeadlineAfter(deadlineSec, TimeUnit.MINUTES);
    }

    public JobAck submit(String sql, String format, int pageSize, long maxRows,
                         String userId, String requestId) {
        SqlJobOptions opts = SqlJobOptions.newBuilder()
                .setFormat(format).setPageSize(pageSize).setMaxRows(maxRows).build();
        SubmitJobRequest req = SubmitJobRequest.newBuilder()
                .setSql(sql == null ? "" : sql)
                .setOptions(opts)
                .setUserId(userId == null ? "anonymous" : userId)
                .setRequestId(requestId == null ? "" : requestId)
                .build();
        return withHeadersAndDeadline(requestId, 2).submit(req);
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

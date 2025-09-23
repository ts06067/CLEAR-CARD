package com.example.clearcard.config;

import com.example.clearcard.JobServiceGrpc;
import com.example.clearcard.sql.SqlControllerGrpc; // <-- new package
import io.grpc.ManagedChannel;
import io.grpc.ManagedChannelBuilder;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.concurrent.TimeUnit;

@Slf4j
@Configuration
@RequiredArgsConstructor
public class GrpcClientConfig {

    private final AppProps props;

    @Bean(destroyMethod = "shutdownNow")
    public ManagedChannel grpcChannel() {
        String host = props.grpc().getHandlerHost();
        int port = props.grpc().getHandlerPort();
        log.info("gRPC channel → {}:{}", host, port);
        return ManagedChannelBuilder.forAddress(host, port)
                .usePlaintext().enableRetry().keepAliveTime(10, TimeUnit.SECONDS)
                .build();
    }

    @Bean
    public JobServiceGrpc.JobServiceBlockingStub jobStub(ManagedChannel ch) {
        return JobServiceGrpc.newBlockingStub(ch);
    }

    @Bean
    public SqlControllerGrpc.SqlControllerBlockingStub sqlStub(ManagedChannel ch) {
        return SqlControllerGrpc.newBlockingStub(ch);
    }
}

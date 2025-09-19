package com.example.clearcard.config;

import com.example.clearcard.JobServiceGrpc;
import io.grpc.ManagedChannel;
import io.grpc.ManagedChannelBuilder;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class GrpcClientConfig {
    private static final Logger log = LoggerFactory.getLogger(GrpcClientConfig.class);

    private final AppProps props;
    public GrpcClientConfig(AppProps props) { this.props = props; }

    @Bean(destroyMethod = "shutdownNow")
    ManagedChannel jobChannel() {
        String host = props.grpc().getHandlerHost();
        int port = props.grpc().getHandlerPort();
        log.info("gRPC JobService channel → {}:{}", host, port);
        return ManagedChannelBuilder
                .forAddress(host, port)
                .usePlaintext() // TLS later
                .build();
    }

    @Bean
    JobServiceGrpc.JobServiceBlockingStub jobStub(ManagedChannel ch) {
        return JobServiceGrpc.newBlockingStub(ch);
    }
}

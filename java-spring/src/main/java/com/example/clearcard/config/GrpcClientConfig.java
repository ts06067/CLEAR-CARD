package com.example.clearcard.config;

import com.example.clearcard.JobServiceGrpc;
import io.grpc.ManagedChannel;
import io.grpc.ManagedChannelBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class GrpcClientConfig {
    private final AppProps props;
    public GrpcClientConfig(AppProps props) { this.props = props; }

    @Bean(destroyMethod = "shutdownNow")
    ManagedChannel jobChannel() {
        return ManagedChannelBuilder
                .forAddress(props.grpc().getHandlerHost(), props.grpc().getHandlerPort())
                .usePlaintext() // TODO: TLS
                .build();
    }

    @Bean
    JobServiceGrpc.JobServiceBlockingStub jobStub(ManagedChannel ch) {
        return JobServiceGrpc.newBlockingStub(ch);
    }
}

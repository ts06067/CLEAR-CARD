// src/main/java/com/example/clearcard/config/AppProps.java
package com.example.clearcard.config;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

@Validated
@ConfigurationProperties(prefix = "app")
public class AppProps {
    private final Grpc grpc = new Grpc();
    private final Gcs gcs = new Gcs();
    private final Csv csv = new Csv();

    public Grpc grpc() { return grpc; }
    public Gcs gcs()   { return gcs; }
    public Csv csv()   { return csv; }

    public static class Grpc {
        @NotBlank
        private String handlerHost = "message-handler";
        @Min(1) @Max(65535)
        private int handlerPort = 50051;

        public String getHandlerHost() { return handlerHost; }
        public void setHandlerHost(String v) { this.handlerHost = v; }
        public int getHandlerPort() { return handlerPort; }
        public void setHandlerPort(int v) { this.handlerPort = v; }
    }

    public static class Gcs {
        @NotBlank
        private String bucket = "clearcard-sql-results";
        public String getBucket() { return bucket; }
        public void setBucket(String v) { this.bucket = v; }
    }

    public static class Csv {
        private String filenamePrefix = "job-";
        public String getFilenamePrefix() { return filenamePrefix; }
        public void setFilenamePrefix(String v) { this.filenamePrefix = v; }
    }
}

package com.example.clearcard.config;

import com.google.cloud.storage.Storage;
import com.google.cloud.storage.StorageOptions;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class GcpConfig {

    @Bean
    public Storage storage() {
        // Uses Application Default Credentials (ADC)
        // - GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json
        // - or metadata credentials on GCE/GKE
        return StorageOptions.getDefaultInstance().getService();
    }
}

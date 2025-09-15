package com.example.clearcard.config;

import io.swagger.v3.oas.models.info.Contact;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.OpenAPI;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OpenApiConfig {
    @Bean
    public OpenAPI apiInfo() {
        return new OpenAPI()
                .info(new Info()
                        .title("CLEAR-CARD API")
                        .version("v1")
                        .description("HTTP endpoints for job submission, status, and CSV download")
                        .contact(new Contact().name("CLEAR-CARD")));
    }
}
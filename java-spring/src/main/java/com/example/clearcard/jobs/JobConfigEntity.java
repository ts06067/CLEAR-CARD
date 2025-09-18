package com.example.clearcard.jobs;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "job_configs")
@Getter @Setter @NoArgsConstructor
public class JobConfigEntity {

    @Id
    @Column(name = "job_id")
    private String jobId;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    private String title;

    @Column(name = "sql_text", nullable = false)
    private String sqlText;

    @Column(name = "table_config")
    private String tableConfig;

    @Column(name = "chart_config")
    private String chartConfig;

    @Column(name = "created_at")
    private Instant createdAt;

    @PrePersist
    void pre() {
        if (createdAt == null) createdAt = Instant.now();
    }
}

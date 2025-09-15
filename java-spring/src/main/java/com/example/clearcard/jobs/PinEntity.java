// PinEntity.java
package com.example.clearcard.jobs;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import lombok.NoArgsConstructor;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "pinned_jobs")
@IdClass(PinId.class)
@Getter @Setter @NoArgsConstructor
public class PinEntity {
    @Id @Column(name="user_id") private UUID userId;
    @Id @Column(name="job_id")  private String jobId;
    @Column(name="pinned_at")   private Instant pinnedAt;
    @PrePersist void pre(){ if(pinnedAt==null) pinnedAt=Instant.now(); }
}

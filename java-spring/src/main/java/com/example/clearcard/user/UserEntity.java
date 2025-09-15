package com.example.clearcard.user;

import lombok.Getter;
import lombok.Setter;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity @Table(name="app_users")
@Getter @Setter
public class UserEntity {
    @Id @Column(name="user_id") private UUID id;
    @Column(nullable=false, unique=true) private String username;
    @Column(name="password_hash", nullable=false) private String passwordHash;
    @Column(name="created_at", nullable=false) private Instant createdAt;

    @PrePersist void pre() {
        if (id==null) id = UUID.randomUUID();
        if (createdAt==null) createdAt = Instant.now();
    }
}
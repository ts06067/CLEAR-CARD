package com.example.clearcard.jobs;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.*;

public interface PinRepository extends JpaRepository<PinEntity, PinId> {
    List<PinEntity> findByUserId(UUID userId);
    boolean existsByUserIdAndJobId(UUID userId, String jobId);
    void deleteByUserIdAndJobId(UUID userId, String jobId);
}

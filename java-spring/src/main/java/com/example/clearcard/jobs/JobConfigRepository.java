package com.example.clearcard.jobs;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.*;

public interface JobConfigRepository extends JpaRepository<JobConfigEntity,String> {
    Optional<JobConfigEntity> findByJobIdAndUserId(String jobId, java.util.UUID userId);
}

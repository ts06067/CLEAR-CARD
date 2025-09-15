package com.example.clearcard.controller;

import com.example.clearcard.jobs.*;
import com.example.clearcard.service.JobClient;
import com.example.clearcard.user.UserRepository;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.User;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@Tag(name="Jobs (List/Detail/Pin)")
@RestController
public class JobQueryController {
    private final JobsDao dao;
    private final JobClient jobClient;
    private final UserRepository users;
    private final JobConfigRepository configs;
    private final PinRepository pins;

    public JobQueryController(JobsDao dao, JobClient jobClient, UserRepository users, JobConfigRepository configs, PinRepository pins) {
        this.dao = dao; this.jobClient = jobClient; this.users = users; this.configs = configs; this.pins = pins;
    }

    @GetMapping("/jobs")  // list my jobs
    public List<JobRow> myJobs(@AuthenticationPrincipal User me,
                               @RequestParam(defaultValue="20") int limit,
                               @RequestParam(defaultValue="0") int offset) {
        return dao.listByUser(me.getUsername(), Math.min(Math.max(limit,1),100), Math.max(offset,0));
    }

    @GetMapping("/jobs/{id}/detail")  // full detail (status + config)
    public ResponseEntity<Map<String,Object>> detail(@AuthenticationPrincipal User me, @PathVariable String id) {
        var u = users.findByUsername(me.getUsername()).orElseThrow();
        var d = dao.getOne(id, me.getUsername()).orElse(null);
        if (d==null) return ResponseEntity.notFound().build();

        var cfg = configs.findByJobIdAndUserId(id, u.getId()).orElse(null);
        var ref = jobClient.manifest(id);  // might be not OK yet
        var out = new LinkedHashMap<String,Object>();
        out.put("job", d);
        out.put("config", cfg);
        out.put("result", Map.of("status", ref.getStatus(), "manifest_gs_uri", ref.getGcsManifestUri(), "error", ref.getErrorMessage()));
        out.put("pinned", pins.existsByUserIdAndJobId(u.getId(), id));
        return ResponseEntity.ok(out);
    }

    @PostMapping("/jobs/{id}/pin")
    public ResponseEntity<Void> pin(@AuthenticationPrincipal User me, @PathVariable String id) {
        var u = users.findByUsername(me.getUsername()).orElseThrow();
        if (!pins.existsByUserIdAndJobId(u.getId(), id)) {
            var p = new PinEntity(); p.setUserId(u.getId()); p.setJobId(id); pins.save(p);
        }
        return ResponseEntity.ok().build();
    }

    @DeleteMapping("/jobs/{id}/pin")
    public ResponseEntity<Void> unpin(@AuthenticationPrincipal User me, @PathVariable String id) {
        var u = users.findByUsername(me.getUsername()).orElseThrow();
        pins.deleteByUserIdAndJobId(u.getId(), id);
        return ResponseEntity.noContent().build();
    }
}

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

@Tag(name = "Jobs (List/Detail/Pin)")
@RestController
public class JobQueryController {
    private final JobsDao dao;
    private final JobClient jobClient;
    private final UserRepository users;
    private final JobConfigRepository configs;
    private final PinRepository pins;
    private final com.fasterxml.jackson.databind.ObjectMapper mapper = new com.fasterxml.jackson.databind.ObjectMapper();

    public JobQueryController(JobsDao dao, JobClient jobClient, UserRepository users,
                              JobConfigRepository configs, PinRepository pins) {
        this.dao = dao; this.jobClient = jobClient; this.users = users; this.configs = configs; this.pins = pins;
    }

    /** Legacy list endpoint (kept for compatibility). */
    @GetMapping("/jobs")
    public ResponseEntity<List<JobRow>> listMyJobsLegacy(@AuthenticationPrincipal User me,
                                                         @RequestParam(defaultValue = "20") int limit,
                                                         @RequestParam(defaultValue = "0") int offset) {
        if (me == null) return ResponseEntity.status(401).build(); // avoid NPE → 500
        var safeLimit = Math.min(Math.max(limit, 1), 100);
        var safeOffset = Math.max(offset, 0);
        return ResponseEntity.ok(dao.listByUser(me.getUsername(), safeLimit, safeOffset));
    }

    /** New endpoint expected by the client: /api/jobs/mine → proxy → /jobs/mine */
    @GetMapping("/jobs/mine")
    public ResponseEntity<List<JobRow>> listMyJobs(@AuthenticationPrincipal User me,
                                                   @RequestParam(defaultValue = "20") int limit,
                                                   @RequestParam(defaultValue = "0") int offset) {
        if (me == null) return ResponseEntity.status(401).build();
        var safeLimit = Math.min(Math.max(limit, 1), 100);
        var safeOffset = Math.max(offset, 0);
        return ResponseEntity.ok(dao.listByUser(me.getUsername(), safeLimit, safeOffset));
    }

    @GetMapping("/jobs/{id}/detail")
    public ResponseEntity<Map<String,Object>> detail(@AuthenticationPrincipal User me, @PathVariable String id) {
        if (me == null) return ResponseEntity.status(401).build();
        var u = users.findByUsername(me.getUsername()).orElseThrow();
        var d = dao.getOne(id, me.getUsername()).orElse(null);
        if (d == null) return ResponseEntity.notFound().build();

        var cfgEnt = configs.findByJobIdAndUserId(id, u.getId()).orElse(null);

        Object qb = null, cfg = null;
        String title = null;
        if (cfgEnt != null) {
            title = cfgEnt.getTitle();
            try { qb  = cfgEnt.getTableConfig()  == null ? null : mapper.readValue(cfgEnt.getTableConfig(),  Object.class); }
            catch (Exception e) { qb = cfgEnt.getTableConfig(); }
            try { cfg = cfgEnt.getChartConfig()  == null ? null : mapper.readValue(cfgEnt.getChartConfig(),  Object.class); }
            catch (Exception e) { cfg = cfgEnt.getChartConfig(); }
        }

        var out = new java.util.LinkedHashMap<String,Object>();
        out.put("id", d.job_id());
        out.put("title", title);
        out.put("sql", d.sql_text());
        out.put("status", d.state());
        out.put("created_at", d.submitted_at().toString());
        out.put("owner_id", me.getUsername());
        out.put("config", java.util.Map.of("qb", qb, "cfg", cfg));
        out.put("pinned", pins.existsByUserIdAndJobId(u.getId(), id));
        return ResponseEntity.ok(out);
    }

    @PostMapping("/jobs/{id}/pin")
    public ResponseEntity<Void> pin(@AuthenticationPrincipal User me, @PathVariable String id) {
        if (me == null) return ResponseEntity.status(401).build();
        var u = users.findByUsername(me.getUsername()).orElseThrow();
        if (!pins.existsByUserIdAndJobId(u.getId(), id)) {
            var p = new PinEntity(); p.setUserId(u.getId()); p.setJobId(id); pins.save(p);
        }
        return ResponseEntity.ok().build();
    }

    @PatchMapping("/jobs/{id}/pin")
    public ResponseEntity<Void> pinPatch(@AuthenticationPrincipal User me,
                                         @PathVariable String id,
                                         @RequestBody java.util.Map<String, Object> body) {
        if (me == null) return ResponseEntity.status(401).build();
        var u = users.findByUsername(me.getUsername()).orElseThrow();

        boolean pinned = false;
        if (body != null && body.containsKey("pinned")) {
            Object v = body.get("pinned");
            pinned = v instanceof Boolean ? (Boolean) v : "true".equalsIgnoreCase(String.valueOf(v));
        }

        if (pinned) {
            if (!pins.existsByUserIdAndJobId(u.getId(), id)) {
                var p = new PinEntity(); p.setUserId(u.getId()); p.setJobId(id); pins.save(p);
            }
            return ResponseEntity.ok().build();
        } else {
            pins.deleteByUserIdAndJobId(u.getId(), id);
            return ResponseEntity.noContent().build();
        }
    }

    @DeleteMapping("/jobs/{id}/pin")
    public ResponseEntity<Void> unpin(@AuthenticationPrincipal User me, @PathVariable String id) {
        if (me == null) return ResponseEntity.status(401).build();
        var u = users.findByUsername(me.getUsername()).orElseThrow();
        pins.deleteByUserIdAndJobId(u.getId(), id);
        return ResponseEntity.noContent().build();
    }
}

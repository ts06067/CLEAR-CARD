package com.example.clearcard.controller;

import com.example.clearcard.dashboard.DashboardDao;
import com.example.clearcard.jobs.PinRepository;
import com.example.clearcard.service.JobClient;
import com.example.clearcard.user.UserRepository;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.User;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@Tag(name="Dashboard")
@RestController
@RequestMapping("/dashboard")
public class DashboardController {
    private final DashboardDao dao;
    private final PinRepository pins;
    private final UserRepository users;
    private final JobClient jobClient;

    public DashboardController(DashboardDao dao, PinRepository pins, UserRepository users, JobClient jobClient) {
        this.dao=dao; this.pins=pins; this.users=users; this.jobClient=jobClient;
    }

    @GetMapping("/default")
    public Map<String,Object> defaults() {
        return Map.of(
                "pubs_total", dao.countsByMeasure("PUBS"),
                "cites_total", dao.countsByMeasure("CITES"),
                "pubs_2024", dao.countsByMeasure("PUBS_2024"),
                "cites_2024", dao.countsByMeasure("CITES_2024"),
                "orig_pubs", dao.countsByMeasure("ORIG_PUBS"),
                "orig_cites", dao.countsByMeasure("ORIG_CITES"),
                "impact_factors", dao.impactFactors()
        );
    }

    @GetMapping("/custom")
    public List<Map<String,Object>> custom(@AuthenticationPrincipal User me) {
        var u = users.findByUsername(me.getUsername()).orElseThrow();
        var list = pins.findByUserId(u.getId());
        var out = new ArrayList<Map<String,Object>>();
        for (var p : list) {
            var ref = jobClient.manifest(p.getJobId());
            out.add(Map.of(
                    "job_id", p.getJobId(),
                    "pinned_at", p.getPinnedAt(),
                    "status", ref.getStatus(),
                    "manifest_gs_uri", ref.getGcsManifestUri(),
                    "error", ref.getErrorMessage()
            ));
        }
        return out;
    }
}

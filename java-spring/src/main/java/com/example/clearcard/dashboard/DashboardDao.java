package com.example.clearcard.dashboard;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import java.util.*;

@Repository
public class DashboardDao {
    private final JdbcTemplate jdbc;
    public DashboardDao(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    public List<Map<String,Object>> countsByMeasure(String measure) {
        return jdbc.queryForList("SELECT journal,[year],value FROM dbo.dashboard_counts WHERE measure=? ORDER BY journal,[year]", measure);
    }

    public List<Map<String,Object>> impactFactors() {
        return jdbc.queryForList("SELECT journal,[year],if_val FROM dbo.dashboard_impact_factors ORDER BY journal,[year]");
    }
}

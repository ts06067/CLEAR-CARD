package com.example.clearcard.jobs;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

@Repository
public class JobsDao {
    private final JdbcTemplate jdbc;
    public JobsDao(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    public List<JobListRow> listByUser(String username, int limit, int offset) {
        String sql = """
            SELECT j.job_id,
                   j.state,
                   j.row_count,
                   j.bytes,
                   j.submitted_at,
                   j.completed_at,
                   cfg.title            AS cfg_title,
                   cfg.table_config     AS cfg_table_config,
                   cfg.chart_config     AS cfg_chart_config
              FROM dbo.jobs j
            LEFT JOIN dbo.job_configs cfg
              ON LOWER(cfg.job_id) = LOWER(j.job_id)
             WHERE j.user_id = ?
             ORDER BY j.submitted_at DESC
             OFFSET ? ROWS FETCH NEXT ? ROWS ONLY
        """;
        return jdbc.query(sql, (rs, i) -> mapJobListRow(rs), username, offset, limit);
    }

    public Optional<JobDetail> getOne(String jobId, String username) {
        String sql = """
           SELECT TOP (1)
                  j.job_id, j.state, j.row_count, j.bytes,
                  j.submitted_at, j.started_at, j.completed_at,
                  j.sql_text, j.format, j.page_size, j.max_rows,
                  j.gcs_uri, j.error_message
             FROM dbo.jobs j
            WHERE j.job_id = ? AND j.user_id = ?
        """;
        List<JobDetail> list = jdbc.query(sql, (rs,i)-> mapJobFull(rs), jobId, username);
        return list.stream().findFirst();
    }

    /* ---------- Mappers ---------- */

    private static JobListRow mapJobListRow(ResultSet rs) throws SQLException {
        Instant submitted = rs.getTimestamp("submitted_at").toInstant();
        var completedTs = rs.getTimestamp("completed_at");
        Instant completed = completedTs == null ? null : completedTs.toInstant();

        String title        = rs.getString("cfg_title");
        String tableConfig  = rs.getString("cfg_table_config");
        String chartConfig  = rs.getString("cfg_chart_config");

        return new JobListRow(
                rs.getString("job_id"),
                rs.getString("state"),
                rs.getLong("row_count"),
                rs.getLong("bytes"),
                submitted,
                completed,
                title,
                tableConfig,
                chartConfig
        );
    }

    private static JobDetail mapJobFull(ResultSet rs) throws SQLException {
        return new JobDetail(
                rs.getString("job_id"),
                rs.getString("state"),
                rs.getLong("row_count"),
                rs.getLong("bytes"),
                rs.getTimestamp("submitted_at").toInstant(),
                rs.getTimestamp("started_at") == null ? null : rs.getTimestamp("started_at").toInstant(),
                rs.getTimestamp("completed_at") == null ? null : rs.getTimestamp("completed_at").toInstant(),
                rs.getString("sql_text"),
                rs.getString("format"),
                rs.getInt("page_size"),
                rs.getLong("max_rows"),
                rs.getString("gcs_uri"),
                rs.getString("error_message")
        );
    }

    /* ---------- Row DTO including config ---------- */
    public static final class JobListRow {
        private final String job_id;
        private final String state;
        private final long row_count;
        private final long bytes;
        private final Instant submitted_at;
        private final Instant completed_at;
        private final String title;
        private final String table_config;
        private final String chart_config;

        public JobListRow(String job_id, String state, long row_count, long bytes,
                          Instant submitted_at, Instant completed_at,
                          String title, String table_config, String chart_config) {
            this.job_id = job_id;
            this.state = state;
            this.row_count = row_count;
            this.bytes = bytes;
            this.submitted_at = submitted_at;
            this.completed_at = completed_at;
            this.title = title;
            this.table_config = table_config;
            this.chart_config = chart_config;
        }

        public String getJob_id() { return job_id; }
        public String getState() { return state; }
        public long getRow_count() { return row_count; }
        public long getBytes() { return bytes; }
        public Instant getSubmitted_at() { return submitted_at; }
        public Instant getCompleted_at() { return completed_at; }

        /** Optional job-config fields (may be null) */
        public String getTitle() { return title; }
        public String getTable_config() { return table_config; }
        public String getChart_config() { return chart_config; }
    }
}

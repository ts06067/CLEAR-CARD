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

    public List<JobRow> listByUser(String username, int limit, int offset) {
        String sql = """
            SELECT j.job_id, j.state, j.row_count, j.bytes, j.submitted_at, j.completed_at
              FROM dbo.jobs j
             WHERE j.user_id = ?
             ORDER BY j.submitted_at DESC
             OFFSET ? ROWS FETCH NEXT ? ROWS ONLY
        """;
        return jdbc.query(sql, (rs, i) -> mapJob(rs), username, offset, limit);
    }

    // FIX: return Optional<JobDetail>, not Optional<JobRow>
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

    private static JobRow mapJob(ResultSet rs) throws SQLException {
        return new JobRow(
                rs.getString("job_id"),
                rs.getString("state"),
                rs.getLong("row_count"),
                rs.getLong("bytes"),
                rs.getTimestamp("submitted_at").toInstant(),
                rs.getTimestamp("completed_at") == null ? null : rs.getTimestamp("completed_at").toInstant()
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
}

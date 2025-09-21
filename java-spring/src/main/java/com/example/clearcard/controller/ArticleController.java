package com.example.clearcard.controller;

import com.example.clearcard.sql.SqlChunk;
import com.example.clearcard.sql.SqlControllerGrpc;
import com.example.clearcard.sql.SqlRequest;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.grpc.Metadata;
import io.grpc.StatusRuntimeException;
import io.grpc.stub.MetadataUtils;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;
import java.util.concurrent.TimeUnit;

@Slf4j
@RestController
@RequestMapping({ "", "/api" })
@RequiredArgsConstructor
public class ArticleController {

    private final SqlControllerGrpc.SqlControllerBlockingStub sqlStub;
    private static final ObjectMapper MAPPER = new ObjectMapper();

    /* ───────────── DTOs ───────────── */

    @Data
    public static class TableJson {
        public List<String> columns = new ArrayList<>();
        public List<List<String>> rows = new ArrayList<>();
        public long total = -1;
        public String status = "OK";
        public String error = "";
    }

    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class ArticleDetail {
        public String cited_eid;
        public String cited_doi;
        public String cited_title;
        public String cited_journal;
        public String cited_pub_date;
        public Integer cited_pub_year;
        public Integer cited_pub_month;
        public Integer cited_pub_day;
        public String cited_category;
        public Double fitness;
        public Double citation_count_2y;
    }

    @Data
    public static class ArticleSearchRequest {
        public JsonNode qb;                 // ConditionBuilder tree
        public String sort = "cited_pub_year";
        public String order = "desc";
        public Integer yearFrom = 2008;
        public Integer yearTo = 2018;
        // legacy quick filters (optional)
        public String q;
        public String category;
    }

    /* ───────────── Helpers ───────────── */

    private TableJson runSql(String sql, int chunkSize, long maxRows, String requestId) {
        TableJson out = new TableJson();
        try {
            Metadata headers = new Metadata();
            Metadata.Key<String> X_REQUEST_ID = Metadata.Key.of("x-request-id", Metadata.ASCII_STRING_MARSHALLER);
            headers.put(X_REQUEST_ID, requestId);

            var stub = sqlStub
                    .withInterceptors(MetadataUtils.newAttachHeadersInterceptor(headers))
                    .withDeadlineAfter(10, TimeUnit.MINUTES);

            SqlRequest req = SqlRequest.newBuilder()
                    .setSql(sql)
                    .setPageSize(Math.max(1, chunkSize))
                    .setRequestId(requestId)
                    .build();

            boolean haveCols = false;
            long rows = 0;

            var it = stub.run(req);
            while (it.hasNext()) {
                SqlChunk ch = it.next();

                if (!haveCols && ch.hasSchema() && ch.getSchema().getColumnsCount() > 0) {
                    out.columns = new ArrayList<>(ch.getSchema().getColumnsList());
                    haveCols = true;
                }
                if (!"OK".equals(ch.getStatus())) {
                    out.status = ch.getStatus();
                    out.error = ch.getErrorMessage();
                    return out;
                }
                for (var r : ch.getRowsList()) {
                    if (rows >= maxRows) break;
                    out.rows.add(new ArrayList<>(r.getCellsList()));
                    rows++;
                }
                if (rows >= maxRows || ch.getLast()) break;
            }
            out.total = out.rows.size(); // client-side pagination: set total = full size
            return out;

        } catch (StatusRuntimeException e) {
            out.status = "ERROR";
            out.error = "gRPC: " + e.getStatus().getCode() + " - " + e.getStatus().getDescription();
            return out;
        } catch (Exception e) {
            out.status = "ERROR";
            out.error = e.toString();
            return out;
        }
    }

    private String escLike(String s) {
        if (s == null) return null;
        return s.replace("[","[[]").replace("%","[%]").replace("_","[_]");
    }

    private String sortClause(String sort, String order) {
        var map = Map.of(
                "cited_pub_year", "cited_pub_year",
                "cited_journal",  "cited_journal",
                "citation_count", "citation_count",
                "fitness",        "fitness",
                "cited_title",    "cited_title"
        );
        String col = map.getOrDefault(sort, "cited_pub_year");
        String dir = ("desc".equalsIgnoreCase(order) ? "DESC" : "ASC");
        return col + " " + dir;
    }

    private Integer toInt(String s) { try { return (s==null||s.isBlank())?null:Integer.valueOf(s); } catch(Exception e){ return null; } }
    private Double  toDbl(String s) { try { return (s==null||s.isBlank())?null:Double.valueOf(s); } catch(Exception e){ return null; } }

    /* ───────────── QB → WHERE (whitelisted) ───────────── */

    private static final class FieldDef {
        final String col;  final String type; // text|number|date
        FieldDef(String col, String type) { this.col = col; this.type = type; }
    }
    private static final Map<String, FieldDef> FIELD_MAP = Map.ofEntries(
            Map.entry("cited_title",     new FieldDef("cited_title", "text")),
            Map.entry("cited_doi",       new FieldDef("cited_doi", "text")),
            Map.entry("cited_journal",   new FieldDef("cited_journal", "text")),
            Map.entry("cited_category",  new FieldDef("cited_category", "text")),
            Map.entry("cited_pub_year",  new FieldDef("cited_pub_year", "number")),
            Map.entry("citation_count",  new FieldDef("citation_count", "number")),
            Map.entry("fitness",         new FieldDef("fitness", "number"))
    );

    private String valToSql(String type, JsonNode v) {
        if (v == null || v.isNull()) return "NULL";
        switch (type) {
            case "number":
                if (v.isNumber()) return v.asText();
                try { return String.valueOf(Double.parseDouble(v.asText().trim())); } catch (Exception e) { return "NULL"; }
            case "date":
                return "CAST(N'" + v.asText().replace("'", "''") + "' AS date)";
            default:
                return "N'" + v.asText().replace("'", "''") + "'";
        }
    }
    private String likeValue(String s) {
        String t = s == null ? "" : s;
        t = t.replace("'", "''").replace("%","[%]").replace("_","[_]").replace("[","[[]");
        return "N'%" + t + "%'";
    }
    private String startsValue(String s) {
        String t = s == null ? "" : s;
        t = t.replace("'", "''").replace("%","[%]").replace("_","[_]").replace("[","[[]");
        return "N'" + t + "%'";
    }
    private String endsValue(String s) {
        String t = s == null ? "" : s;
        t = t.replace("'", "''").replace("%","[%]").replace("_","[_]").replace("[","[[]");
        return "N'%" + t + "'";
    }

    private String qbToWhere(JsonNode node) {
        if (node == null || node.isNull()) return "1=1";
        if (node.has("rules") && node.has("combinator")) {
            String comb = "and".equalsIgnoreCase(node.get("combinator").asText()) ? "AND" : "OR";
            List<String> parts = new ArrayList<>();
            for (JsonNode child : node.get("rules")) parts.add("(" + qbToWhere(child) + ")");
            return parts.isEmpty() ? "1=1" : String.join(" " + comb + " ", parts);
        }
        String field = node.path("field").asText("");
        String op    = node.path("op").asText(node.path("operator").asText("eq"));
        JsonNode val = node.get("value");
        FieldDef def = FIELD_MAP.get(field);
        if (def == null) return "1=1";
        String col = def.col, t = def.type, sql;
        switch (op) {
            case "eq":  case "=":  sql = val==null||val.isNull()? col+" IS NULL" : col+" = "+valToSql(t,val); break;
            case "neq": case "!=": sql = val==null||val.isNull()? col+" IS NOT NULL" : col+" <> "+valToSql(t,val); break;
            case "gt":  sql = col+" > "+valToSql(t,val);  break;
            case "gte": sql = col+" >= "+valToSql(t,val); break;
            case "lt":  sql = col+" < "+valToSql(t,val);  break;
            case "lte": sql = col+" <= "+valToSql(t,val); break;
            case "between": {
                JsonNode a = (val!=null && val.isArray() && val.size()>0)? val.get(0):null;
                JsonNode b = (val!=null && val.isArray() && val.size()>1)? val.get(1):null;
                sql = "(" + col + " BETWEEN " + valToSql(t,a) + " AND " + valToSql(t,b) + ")";
                break;
            }
            case "in": case "not_in": {
                List<String> arr = new ArrayList<>();
                if (val != null && val.isArray()) for (JsonNode x : val) arr.add(valToSql(t,x));
                if (arr.isEmpty()) arr.add("NULL");
                sql = col + ("not_in".equals(op) ? " NOT IN (" : " IN (") + String.join(",", arr) + ")";
                break;
            }
            case "contains":     sql = col + " LIKE " + likeValue(val==null? "": val.asText());  break;
            case "begins_with":
            case "starts_with":  sql = col + " LIKE " + startsValue(val==null? "": val.asText()); break;
            case "ends_with":    sql = col + " LIKE " + endsValue(val==null? "": val.asText());   break;
            case "is_null":      sql = col + " IS NULL";     break;
            case "not_null":     sql = col + " IS NOT NULL"; break;
            default:             sql = "1=1";
        }
        return sql;
    }

    /* ───────────── GET /articles (no server paging) ───────────── */
    @GetMapping(value = "/articles", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<TableJson> list(
            @RequestParam(defaultValue = "") String q,
            @RequestParam(required = false) String category,
            @RequestParam(defaultValue = "2008") @Min(1500) @Max(2100) int yearFrom,
            @RequestParam(defaultValue = "2018") @Min(1500) @Max(2100) int yearTo,
            @RequestParam(defaultValue = "cited_pub_year") String sort,
            @RequestParam(defaultValue = "desc") String order
    ) {
        String sortSql = sortClause(sort, order);
        String like = escLike(q);

        String ctes = baseCtes(yearFrom, yearTo);

        String where = " WHERE 1=1 ";
        if (like != null && !like.isBlank()) {
            where += " AND (cited_title LIKE N'%" + like + "%' ESCAPE '\\' OR cited_doi LIKE N'%" + like +
                    "%' ESCAPE '\\' OR cited_journal LIKE N'%" + like + "%' ESCAPE '\\') ";
        }
        if (category != null && !category.isBlank()) {
            String cat = category.replace("'", "''");
            where += " AND (cited_category = N'" + cat + "') ";
        }

        String sql = ctes + """
SELECT
    cited_eid, cited_doi, cited_title, cited_journal,
    cited_pub_date, cited_pub_year, cited_pub_month, cited_pub_day,
    cited_category, citation_count, fitness
FROM condition
""" + where + "ORDER BY " + sortSql + ";";

        // stream all; cap via maxRows (increase if needed)
        var t = runSql(sql, 5000, 10_000_000L, UUID.randomUUID().toString());
        return ResponseEntity.ok(t);
    }

    /* ───────────── POST /articles/search (QB; no server paging) ───────────── */
    @PostMapping(value = "/articles/search", consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<TableJson> search(@RequestBody ArticleSearchRequest req) {
        int yearFrom = req.yearFrom == null ? 2008 : req.yearFrom;
        int yearTo   = req.yearTo   == null ? 2018 : req.yearTo;
        String sortSql = sortClause(req.sort == null ? "cited_pub_year" : req.sort,
                req.order == null ? "desc" : req.order);

        String where = " WHERE 1=1 ";

        if (req.q != null && !req.q.isBlank()) {
            String like = escLike(req.q);
            where += " AND (cited_title LIKE N'%" + like + "%' ESCAPE '\\' OR cited_doi LIKE N'%" + like +
                    "%' ESCAPE '\\' OR cited_journal LIKE N'%" + like + "%' ESCAPE '\\') ";
        }
        if (req.category != null && !req.category.isBlank()) {
            where += " AND (cited_category = N'" + req.category.replace("'", "''") + "')";
        }
        if (req.qb != null && !req.qb.isNull()) {
            try {
                String qbWhere = qbToWhere(req.qb);
                if (qbWhere != null && !qbWhere.isBlank() && !"1=1".equals(qbWhere)) {
                    where += " AND (" + qbWhere + ") ";
                }
            } catch (Exception e) {
                log.warn("QB parse error: {}", e.toString());
            }
        }

        String sql = baseCtes(yearFrom, yearTo) + """
SELECT
    cited_eid, cited_doi, cited_title, cited_journal,
    cited_pub_date, cited_pub_year, cited_pub_month, cited_pub_day,
    cited_category, citation_count, fitness
FROM condition
""" + where + "ORDER BY " + sortSql + ";";

        var t = runSql(sql, 5000, 10_000_000L, UUID.randomUUID().toString());
        return ResponseEntity.ok(t);
    }

    /* ───────────── DETAIL & CITERS (unchanged) ───────────── */

    @GetMapping(value = "/articles/{eid}", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<ArticleDetail> detail(@PathVariable("eid") String eid) {
        String safeEid = eid.replace("'", "''");
        String sql = baseCtes(null, null).replace(
                "AND pp.cited_pub_year BETWEEN %s AND %s",
                "AND 1=1"
        ) + """
SELECT TOP (1)
    cited_eid, cited_doi, cited_title, cited_journal,
    cited_pub_date, cited_pub_year, cited_pub_month, cited_pub_day,
    cited_category, citation_count, fitness
FROM condition
WHERE cited_eid = N'%s';
""".formatted(safeEid);

        var t = runSql(sql, 512, 1, UUID.randomUUID().toString());
        if (!"OK".equals(t.status) || t.rows.isEmpty()) return ResponseEntity.ok().body(null);

        Map<String,Integer> idx = new HashMap<>();
        for (int i=0;i<t.columns.size();i++) idx.put(t.columns.get(i), i);
        var row = t.rows.get(0);

        ArticleDetail d = new ArticleDetail();
        d.cited_eid         = row.get(idx.get("cited_eid"));
        d.cited_doi         = row.get(idx.get("cited_doi"));
        d.cited_title       = row.get(idx.get("cited_title"));
        d.cited_journal     = row.get(idx.get("cited_journal"));
        d.cited_pub_date    = row.get(idx.get("cited_pub_date"));
        d.cited_pub_year    = toInt(row.get(idx.get("cited_pub_year")));
        d.cited_pub_month   = toInt(row.get(idx.get("cited_pub_month")));
        d.cited_pub_day     = toInt(row.get(idx.get("cited_pub_day")));
        d.cited_category    = row.get(idx.get("cited_category"));
        d.fitness           = toDbl(row.get(idx.get("fitness")));
        d.citation_count_2y = toDbl(row.get(idx.get("citation_count")));
        return ResponseEntity.ok(d);
    }

    @GetMapping(value = "/articles/{eid}/cites", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<TableJson> citing(@PathVariable("eid") String eid) {
        String safeEid = eid.replace("'", "''");
        String sql = """
WITH base AS (
    SELECT
        p.paper_id AS cited_id,
        p.eid AS cited_eid,
        p.[prism:doi] AS cited_doi,
        p.[dc:title] AS cited_title,
        p.[prism:publicationName] AS cited_journal,
        CAST(p.[prism:coverDate] AS date) AS cited_pub_date,
        YEAR(p.[prism:coverDate])  AS cited_pub_year,
        MONTH(p.[prism:coverDate]) AS cited_pub_month,
        DAY(p.[prism:coverDate])   AS cited_pub_day,
        c.paper_id AS citing_id,
        c.eid AS citing_eid,
        c.[prism:doi] AS citing_doi,
        c.[dc:title] AS citing_title,
        c.[prism:publicationName] AS citing_journal,
        CAST(c.[prism:coverDate] AS date) AS citing_pub_date,
        YEAR(c.[prism:coverDate])  AS citing_pub_year,
        MONTH(c.[prism:coverDate]) AS citing_pub_month,
        DAY(c.[prism:coverDate])   AS citing_pub_day,
        CAST(DATEDIFF(DAY, p.[prism:coverDate], c.[prism:coverDate]) AS float) AS citation_time_days
    FROM scopus.dbo.[relationship] r
    JOIN scopus.dbo.[paper]    p ON p.paper_id = r.paper_id_1
    JOIN scopus.dbo.[citation] c ON c.paper_id = r.paper_id_2
    WHERE r.[relationship] = 'citing'
      AND p.[prism:coverDate] IS NOT NULL
      AND c.[prism:coverDate] IS NOT NULL
),
per_pair AS ( SELECT b.* FROM base b ),
condition AS (
    SELECT
        pp.cited_doi,
        pp.cited_eid,
        pp.citing_doi,
        pp.citing_eid,
        pp.citing_journal,
        pp.citing_title,
        pp.citing_pub_date,
        pp.citation_time_days
    FROM per_pair pp
    WHERE pp.cited_eid = N'%s'
)
SELECT
    cited_eid, citing_eid, citing_doi, citing_title, citing_journal,
    citing_pub_date, citation_time_days
FROM condition
ORDER BY citation_time_days ASC;
""".formatted(safeEid);

        var t = runSql(sql, 4096, 100000, UUID.randomUUID().toString());
        return ResponseEntity.ok(t);
    }

    /* ───────────── SQL CTEs ───────────── */

    private String baseCtes(Integer yearFrom, Integer yearTo) {
        String yFrom = String.valueOf(yearFrom == null ? 2008 : yearFrom);
        String yTo   = String.valueOf(yearTo   == null ? 2018 : yearTo);
        return """
DECLARE @fitness_bin_size      float = 10.0;
DECLARE @citation_count_bin_sz float = 1.0;

WITH base AS (
    SELECT
        p.paper_id AS cited_id,
        p.eid AS cited_eid,
        p.[prism:doi] AS cited_doi,
        p.[dc:title] AS cited_title,
        p.[prism:publicationName] AS cited_journal,
        CAST(p.[prism:coverDate] AS date) AS cited_pub_date,
        YEAR(p.[prism:coverDate])  AS cited_pub_year,
        MONTH(p.[prism:coverDate]) AS cited_pub_month,
        DAY(p.[prism:coverDate])   AS cited_pub_day,
        c.paper_id AS citing_id,
        c.eid AS citing_eid,
        c.[prism:doi] AS citing_doi,
        c.[dc:title] AS citing_title,
        c.[prism:publicationName] AS citing_journal,
        CAST(c.[prism:coverDate] AS date) AS citing_pub_date,
        YEAR(c.[prism:coverDate])  AS citing_pub_year,
        MONTH(c.[prism:coverDate]) AS citing_pub_month,
        DAY(c.[prism:coverDate])   AS citing_pub_day,
        CAST(DATEDIFF(DAY, p.[prism:coverDate], c.[prism:coverDate]) AS float) AS citation_time_days
    FROM scopus.dbo.[relationship] r
    JOIN scopus.dbo.[paper]    p ON p.paper_id = r.paper_id_1
    JOIN scopus.dbo.[citation] c ON c.paper_id = r.paper_id_2
    WHERE r.[relationship] = 'citing'
      AND p.[prism:coverDate] IS NOT NULL
      AND c.[prism:coverDate] IS NOT NULL
),
cat AS (
    SELECT target_eid, MAX(category) AS cited_category, MAX(category_raw) AS cited_category_raw
    FROM category.dbo.[article]
    GROUP BY target_eid
),
fit AS (
    SELECT target_eid, MAX(CAST(fitness AS float)) AS cited_fitness
    FROM fitness.dbo.[article]
    GROUP BY target_eid
),
per_pair AS (
    SELECT
        b.*,
        ca.cited_category,
        ca.cited_category_raw,
        f.cited_fitness
    FROM base b
    LEFT JOIN cat ca ON ca.target_eid = b.cited_eid
    LEFT JOIN fit f  ON f.target_eid  = b.cited_eid
),
condition AS (
    SELECT
        pp.cited_doi,
        pp.cited_title,
        pp.cited_journal,
        pp.cited_pub_date,
        pp.cited_pub_year,
        pp.cited_pub_month,
        pp.cited_pub_day,
        pp.cited_category,
        pp.cited_eid,
        CAST(COUNT(pp.cited_eid) AS float)   AS citation_count,
        CAST(MAX(pp.cited_fitness) AS float) AS fitness
    FROM per_pair pp
    WHERE
        pp.citation_time_days <= 365.25*2
        AND pp.cited_pub_year BETWEEN %s AND %s
    GROUP BY
        pp.cited_doi, pp.cited_title, pp.cited_journal,
        pp.cited_pub_date, pp.cited_pub_year, pp.cited_pub_month, pp.cited_pub_day,
        pp.cited_category, pp.cited_eid
)
""".formatted(yFrom, yTo);
    }
}

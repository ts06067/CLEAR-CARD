import type { RuleGroupTypeAny, RuleType, RuleGroupType } from "react-querybuilder";
import type { ChartConfig } from "../features/config/chartConfig";

// Escape single quotes (basic)
const q = (v: string) => `'${String(v).replace(/'/g, "''")}'`;
const list = (csv: string) =>
  csv
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map(q)
    .join(", ");

const fieldToSql = (field: string) => `pp.${field}`;

function ruleToSql(r: RuleType): string {
  const f = fieldToSql(r.field as string);
  const op = r.operator;
  const v = (r as any).value;

  if (["contains", "doesNotContain", "beginsWith", "endsWith"].includes(op)) {
    const val = String(v);
    if (op === "contains") return `${f} LIKE ${q(`%${val}%`)}`;
    if (op === "doesNotContain") return `${f} NOT LIKE ${q(`%${val}%`)}`;
    if (op === "beginsWith") return `${f} LIKE ${q(`${val}%`)}`;
    if (op === "endsWith") return `${f} LIKE ${q(`${val}`)}`;
  }

  if (["=", "!=", "<", ">", "<=", ">="].includes(op)) {
    const lit = typeof v === "number" ? String(v) : q(String(v));
    return `${f} ${op} ${lit}`;
  }

  if (op === "between" && Array.isArray(v) && v.length === 2) {
    const a = typeof v[0] === "number" ? String(v[0]) : q(String(v[0]));
    const b = typeof v[1] === "number" ? String(v[1]) : q(String(v[1]));
    return `${f} BETWEEN ${a} AND ${b}`;
  }

  if (op === "in") return `${f} IN (${list(String(v))})`;
  if (op === "notIn") return `${f} NOT IN (${list(String(v))})`;

  return "1=1";
}

export function whereFromQuery(qb: RuleGroupTypeAny): string {
  if (!(qb && (qb as any).rules)) return "1=1";
  const walk = (g: RuleGroupType): string =>
    (g.rules as any[]).length
      ? (g.rules as any[])
          .map((r) => ("rules" in r ? `(${walk(r as RuleGroupType)})` : ruleToSql(r as RuleType)))
          .join(` ${(g.combinator || "and").toUpperCase()} `)
      : "1=1";
  return walk(qb as RuleGroupType);
}

export function buildSql(qb: RuleGroupTypeAny, cfg: ChartConfig): string {
  const where = whereFromQuery(qb);

  const yExpr =
    cfg.yField === "n_article" ? "COUNT(*) AS n_articles" : `${cfg.yAgg}(${cfg.yField}) AS y_value`;

  const groups = Array.from(new Set([cfg.x, ...cfg.groupBy]));
  const groupSql = groups.join(", ");
  const orderSql = `${cfg.x} ${cfg.orderDir}`;

  return `
DECLARE @fitness_bin_size float = ${cfg.fitnessBinSize};
DECLARE @citation_count_bin_sz float = ${cfg.citationCountBinSize};

WITH base AS (
  SELECT p.paper_id AS cited_id, p.eid AS cited_eid, p.[prism:doi] AS cited_doi,
         p.[dc:title] AS cited_title, p.[prism:publicationName] AS cited_journal,
         CAST(p.[prism:coverDate] AS date) AS cited_pub_date,
         YEAR(p.[prism:coverDate]) AS cited_pub_year,
         MONTH(p.[prism:coverDate]) AS cited_pub_month,
         DAY(p.[prism:coverDate]) AS cited_pub_day,
         c.paper_id AS citing_id, c.eid AS citing_eid, c.[prism:doi] AS citing_doi,
         c.[dc:title] AS citing_title, c.[prism:publicationName] AS citing_journal,
         CAST(c.[prism:coverDate] AS date) AS citing_pub_date,
         YEAR(c.[prism:coverDate]) AS citing_pub_year,
         MONTH(c.[prism:coverDate]) AS citing_pub_month,
         DAY(c.[prism:coverDate]) AS citing_pub_day,
         CAST(DATEDIFF(DAY, p.[prism:coverDate], c.[prism:coverDate]) AS float) AS citation_time_days
  FROM scopus.dbo.[relationship] r
  JOIN scopus.dbo.[paper] p ON p.paper_id = r.paper_id_1
  JOIN scopus.dbo.[citation] c ON c.paper_id = r.paper_id_2
  WHERE r.[relationship] = 'citing'
    AND p.[prism:coverDate] IS NOT NULL AND c.[prism:coverDate] IS NOT NULL
),
cat AS (
  SELECT target_eid, MAX(category) AS category, MAX(category_raw) AS category_raw
  FROM category.dbo.[article] GROUP BY target_eid
),
fit AS (
  SELECT target_eid, MAX(CAST(fitness AS float)) AS fitness
  FROM fitness.dbo.[article] GROUP BY target_eid
),
per_pair AS (
  SELECT b.*, ca.category AS cited_category, ca.category_raw AS cited_category_raw, f.fitness AS cited_fitness
  FROM base b
  LEFT JOIN cat ca ON ca.target_eid = b.cited_eid
  LEFT JOIN fit f ON f.target_eid = b.cited_eid
),
condition AS (
  SELECT
    pp.cited_pub_date, pp.cited_pub_year, pp.cited_pub_month, pp.cited_pub_day,
    pp.cited_journal, pp.cited_category, pp.cited_eid,
    CAST(COUNT(pp.cited_eid) AS float) AS citation_count,
    CAST(MAX(pp.cited_fitness) AS float) AS fitness
  FROM per_pair pp
  WHERE ${where}
  GROUP BY
    pp.cited_pub_date, pp.cited_pub_year, pp.cited_pub_month, pp.cited_pub_day,
    pp.cited_journal, pp.cited_category, pp.cited_eid
),
with_percentiles AS (
  SELECT c.*,
    PERCENT_RANK() OVER (
      PARTITION BY c.cited_pub_year, c.cited_journal ORDER BY c.fitness) AS fitness_pr,
    PERCENT_RANK() OVER (
      PARTITION BY c.cited_pub_year, c.cited_journal ORDER BY c.citation_count) AS citation_count_pr
  FROM condition c
),
aggregation AS (
  SELECT
    cited_pub_date, cited_pub_year, cited_pub_month, cited_pub_day,
    cited_journal, cited_category, cited_eid,
    COUNT(*) AS n_articles,
    ROUND(AVG(fitness), 2) AS fitness_mean,
    ROUND(STDEV(fitness), 2) AS fitness_std,
    ROUND(AVG(citation_count), 2) AS citation_count_mean,
    ROUND(STDEV(citation_count), 2) AS citation_count_std,
    CAST(ROUND(100.0 * AVG(fitness_pr), 2) AS decimal(5,2)) AS fitness_percentile,
    CAST(ROUND(100.0 * AVG(citation_count_pr), 2) AS decimal(5,2)) AS citation_count_percentile,
    CAST(FLOOR(AVG(fitness) / @fitness_bin_size) AS int) AS fitness_bin_raw,
    CAST(FLOOR(AVG(citation_count) / @citation_count_bin_sz) AS int) AS citation_count_bin_raw,
    CAST(FLOOR((100.0 * AVG(fitness_pr)) / 10.0) AS int) AS fitness_percentile_decile,
    CAST(FLOOR((100.0 * AVG(citation_count_pr)) / 10.0) AS int) AS citation_count_percentile_decile
  FROM with_percentiles
  GROUP BY
    cited_pub_date, cited_pub_year, cited_pub_month, cited_pub_day,
    cited_journal, cited_category, cited_eid
)

SELECT ${groups.join(", ")}, ${yExpr}
FROM aggregation
GROUP BY ${groupSql}
ORDER BY ${orderSql};
`;
}

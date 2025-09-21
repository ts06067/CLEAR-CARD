/* eslint-disable @typescript-eslint/no-explicit-any */
import type { RuleGroupTypeAny, RuleType, RuleGroupType } from "react-querybuilder";
import type { ChartConfig } from "../features/config/chartConfig";
import { FIELDS, isNumericField, isDateField } from "../features/builder/fields";

/* ----------------------- sets by stage ----------------------- */
// Fields that exist on per_pair (i.e., come from base + joins)
const CONDITION_AGG_FIELDS = new Set(["citation_count", "fitness"]); // computed inside condition CTE
const AGG_ONLY_FIELDS = new Set([
  "citation_count_bin_raw",
  "fitness_bin_raw",
  "citation_count_percentile_decile",
  "fitness_percentile_decile",
  // You can add: 'n_articles','fitness_mean','citation_count_mean','fitness_std','citation_count_std' if you expose them
]);

// per_pair = all fields except the ones known to be computed later
const PER_PAIR_FIELDS = new Set(
  FIELDS.map(f => f.name).filter(n => !CONDITION_AGG_FIELDS.has(n) && !AGG_ONLY_FIELDS.has(n))
);

/* ----------------------- tiny helpers ----------------------- */

const quote = (v: string) => `'${String(v).replace(/'/g, "''")}'`;

function toNumeric(v: any): string {
  const n = typeof v === "number" ? v : Number(v);
  // keep as-is if NaN; SQL will fail clearly rather than silently convert
  return Number.isFinite(n) ? String(n) : String(v);
}

function lit(field: string, v: any): string {
  if (isNumericField(field)) return toNumeric(v);
  if (isDateField(field)) return quote(String(v));
  // text
  return quote(String(v));
}

function csvList(field: string, csvOrArray: any): string {
  const arr = Array.isArray(csvOrArray)
    ? csvOrArray
    : String(csvOrArray)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
  return arr.map((item) => lit(field, item)).join(", ");
}

/* ------------- rule rendering per context (stage) ------------- */

type Ctx = "per" | "condAgg" | "agg";

// Aggregate expressions available in the 'condition' CTE for HAVING
function condAggExprFor(field: string): string {
  if (field === "citation_count") return "CAST(COUNT(pp.cited_eid) AS float)";
  if (field === "fitness") return "CAST(MAX(pp.cited_fitness) AS float)";
  // default: treat as per_pair (shouldn't happen)
  return `pp.${field}`;
}

// Field expression for each context
function fieldExpr(field: string, ctx: Ctx): string {
  if (ctx === "per") return `pp.${field}`;
  if (ctx === "condAgg") return condAggExprFor(field);
  // agg: columns are materialized in 'aggregation' CTE
  return `[${field}]`;
}

function ruleToSqlInCtx(r: RuleType, ctx: Ctx): string {
  const field = String(r.field);
  const op = String(r.operator);
  const v: any = (r as any).value;

  const f = fieldExpr(field, ctx);

  // text operators
  if (op === "contains")       return `${f} LIKE ${quote(`%${String(v)}%`)}`;
  if (op === "doesNotContain") return `${f} NOT LIKE ${quote(`%${String(v)}%`)}`;
  if (op === "beginsWith")     return `${f} LIKE ${quote(`${String(v)}%`)}`;
  // NOTE: preserved original endsWith behavior (no leading %)
  if (op === "endsWith")       return `${f} LIKE ${quote(String(v))}`;

  // comparisons
  if (op === "=" || op === "!=" || op === "<" || op === ">" || op === "<=" || op === ">=") {
    return `${f} ${op} ${lit(field, v)}`;
  }

  // between / notBetween
  if ((op === "between" || op === "notBetween") && Array.isArray(v) && v.length === 2) {
    const a = lit(field, v[0]);
    const b = lit(field, v[1]);
    return `${f} ${op === "between" ? "BETWEEN" : "NOT BETWEEN"} ${a} AND ${b}`;
  }

  // in / notIn
  if (op === "in")    return `${f} IN (${csvList(field, v)})`;
  if (op === "notIn") return `${f} NOT IN (${csvList(field, v)})`;

  // null checks
  if (op === "isNull")    return `${f} IS NULL`;
  if (op === "isNotNull") return `${f} IS NOT NULL`;

  // fallback
  return "1=1";
}

/* ---------------- logical builder with filtering --------------- */

function buildBoolean(
  qb: RuleGroupTypeAny,
  ctx: Ctx,
  includeField: (name: string) => boolean
): string {
  if (!qb || !(qb as any).rules) return "1=1";

  const walk = (g: RuleGroupType): string => {
    const rules = (g.rules as any[]) ?? [];
    if (!rules.length) return "1=1";
    const comb = (g.combinator || "and").toString().toUpperCase() === "OR" ? "OR" : "AND";

    const parts: string[] = [];
    for (const r of rules) {
      if ("rules" in (r as any)) {
        const sub = walk(r as RuleGroupType);
        if (sub && sub !== "1=1") parts.push(`(${sub})`);
      } else {
        const field = String((r as any).field);
        if (!includeField(field)) continue;
        parts.push(ruleToSqlInCtx(r as RuleType, ctx));
      }
    }
    let clause = parts.join(` ${comb} `);
    if (!clause) clause = "1=1";
    if ((g as any).not) clause = `NOT (${clause})`;
    return clause;
  };

  return walk(qb as RuleGroupType);
}

/* ---- convenience filters per stage (which fields are allowed) --- */

const includePerPair = (name: string) => PER_PAIR_FIELDS.has(name);
const includeCondAgg = (name: string) => CONDITION_AGG_FIELDS.has(name);
const includeAggOnly = (name: string) => AGG_ONLY_FIELDS.has(name);

/* ------------------------- main builder ------------------------- */

export function buildSql(qb: RuleGroupTypeAny, cfg: ChartConfig): string {
  // Split the conditions per stage
  const preWhere = buildBoolean(qb, "per", includePerPair);              // WHERE in condition CTE (on pp.*)
  const condHaving = buildBoolean(qb, "condAgg", includeCondAgg);        // HAVING in condition CTE (COUNT/MAX expr)
  const aggWhere = buildBoolean(qb, "agg", includeAggOnly);              // WHERE after aggregation CTE

  // y expression (keep your original aliases)
  const yExpr =
    cfg.yAgg === "COUNT" || cfg.yField === "n_article"
      ? "COUNT(*) AS n_articles"
      : // MEDIAN support: compute from aggregation-level numeric column (SQL Server lacks MEDIAN aggregate; users typically post-process.
        // We keep MEDIAN here only to satisfy the UI type; the server-side can replace this expression if needed.
        (cfg.yAgg === "MEDIAN"
          ? "AVG(y_value) AS y_value" // placeholder; real median requires PERCENTILE_CONT/PERCENTILE_DISC
          : `${cfg.yAgg}(${cfg.yField}) AS y_value`);

  const groups = Array.from(new Set([cfg.x, ...cfg.groupBy]));
  const groupSql = groups.join(", ");
  const orderSql = `${cfg.x} ${cfg.orderDir}`;

  // Build SQL
  const sql = `
DECLARE @fitness_bin_size float = ${Number(cfg.fitnessBinSize)};
DECLARE @citation_count_bin_sz float = ${Number(cfg.citationCountBinSize)};

WITH base AS (
  SELECT
    p.paper_id AS cited_id, p.eid AS cited_eid, p.[prism:doi] AS cited_doi,
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
  JOIN scopus.dbo.[paper]     p ON p.paper_id = r.paper_id_1
  JOIN scopus.dbo.[citation]  c ON c.paper_id = r.paper_id_2
  WHERE r.[relationship] = 'citing'
    AND p.[prism:coverDate] IS NOT NULL
    AND c.[prism:coverDate] IS NOT NULL
),
cat AS (
  SELECT target_eid, MAX(category) AS category, MAX(category_raw) AS category_raw
  FROM category.dbo.[article]
  GROUP BY target_eid
),
fit AS (
  SELECT target_eid, MAX(CAST(fitness AS float)) AS fitness
  FROM fitness.dbo.[article]
  GROUP BY target_eid
),
per_pair AS (
  SELECT
    b.*,
    ca.category     AS cited_category,
    ca.category_raw AS cited_category_raw,
    f.fitness       AS cited_fitness
  FROM base b
  LEFT JOIN cat ca ON ca.target_eid = b.cited_eid
  LEFT JOIN fit f  ON f.target_eid = b.cited_eid
),
condition AS (
  SELECT
    pp.cited_pub_date, pp.cited_pub_year, pp.cited_pub_month, pp.cited_pub_day,
    pp.cited_journal, pp.cited_category, pp.cited_eid,
    CAST(COUNT(pp.cited_eid) AS float) AS citation_count,
    CAST(MAX(pp.cited_fitness) AS float) AS fitness
  FROM per_pair pp
  ${preWhere && preWhere !== "1=1" ? `WHERE ${preWhere}` : ""}
  GROUP BY
    pp.cited_pub_date, pp.cited_pub_year, pp.cited_pub_month, pp.cited_pub_day,
    pp.cited_journal, pp.cited_category, pp.cited_eid
  ${condHaving && condHaving !== "1=1" ? `HAVING ${condHaving}` : ""}
),
with_percentiles AS (
  SELECT
    c.*,
    PERCENT_RANK() OVER (PARTITION BY c.cited_pub_year, c.cited_journal ORDER BY c.fitness)         AS fitness_pr,
    PERCENT_RANK() OVER (PARTITION BY c.cited_pub_year, c.cited_journal ORDER BY c.citation_count)  AS citation_count_pr
  FROM condition c
),
aggregation AS (
  SELECT
    cited_pub_date, cited_pub_year, cited_pub_month, cited_pub_day,
    cited_journal, cited_category, cited_eid,
    COUNT(*)                         AS n_articles,
    ROUND(AVG(fitness), 2)           AS fitness,
    --ROUND(STDEV(fitness), 2)         AS fitness_std,
    ROUND(AVG(citation_count), 2)    AS citation_count,
    --ROUND(STDEV(citation_count), 2)  AS citation_count_std,
    CAST(ROUND(100.0 * AVG(fitness_pr), 2) AS decimal(5,2))         AS fitness_percentile,
    CAST(ROUND(100.0 * AVG(citation_count_pr), 2) AS decimal(5,2))  AS citation_count_percentile,
    CAST(FLOOR(AVG(fitness) / @fitness_bin_size) AS int)            AS fitness_bin_raw,
    CAST(FLOOR(AVG(citation_count) / @citation_count_bin_sz) AS int) AS citation_count_bin_raw,
    CAST(FLOOR((100.0 * AVG(fitness_pr)) / 10.0) AS int)            AS fitness_percentile_decile,
    CAST(FLOOR((100.0 * AVG(citation_count_pr)) / 10.0) AS int)     AS citation_count_percentile_decile
  FROM with_percentiles
  GROUP BY
    cited_pub_date, cited_pub_year, cited_pub_month, cited_pub_day,
    cited_journal, cited_category, cited_eid
)

SELECT ${groups.join(", ")}, ${yExpr}
FROM aggregation
${aggWhere && aggWhere !== "1=1" ? `WHERE ${aggWhere}` : ""}
GROUP BY ${groupSql}
ORDER BY ${orderSql};
`.trim();

  return sql;
}

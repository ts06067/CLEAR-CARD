import { FIELDS, isNumericField } from "../builder/fields";

/**
 * Keep a strongly-typed union of the axis-capable fields.
 * This matches your previous version exactly.
 */
export const AXIS_FIELDS = [
  "cited_journal",
  "cited_pub_year",
  "cited_pub_month",
  "cited_pub_day",
  "cited_pub_date",
  "cited_eid",
  "cited_category",
  "fitness",
  "citation_count",
  "citation_count_bin_raw",
  "fitness_bin_raw",
  "citation_count_percentile_decile",
  "fitness_percentile_decile"
] as const;

export type AxisField = typeof AXIS_FIELDS[number];

export type Aggregation = "COUNT" | "AVG" | "MIN" | "MAX" | "MEDIAN";

/** Keep this shape aligned with buildSql.ts */
export interface ChartConfig {
  x: AxisField;
  groupBy: AxisField[];
  orderDir: "ASC" | "DESC";
  yField: "n_article" | AxisField;
  yAgg: Aggregation;
  fitnessBinSize: number;
  citationCountBinSize: number;
}

export const COUNT_SENTINEL = "n_article";

/** UI helpers */
export const axisCandidates: AxisField[] = [...AXIS_FIELDS];
export const numericCandidates: string[] = FIELDS.filter(f => f.type === "number").map(f => f.name);

/** Sensible defaults */
export const defaultChartConfig: ChartConfig = {
  x: "cited_pub_year",
  groupBy: ["cited_journal"],
  orderDir: "ASC",
  yField: COUNT_SENTINEL,
  yAgg: "COUNT",
  fitnessBinSize: 10.0,
  citationCountBinSize: 1.0
};

export function validYField(field: string, agg: Aggregation): boolean {
  if (agg === "COUNT") return true;
  // For AVG/MIN/MAX/MEDIAN we need numeric fields
  return isNumericField(field);
}

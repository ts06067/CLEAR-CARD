export type AxisField =
  | "cited_journal"
  | "cited_pub_year"
  | "cited_pub_month"
  | "cited_pub_day"
  | "cited_pub_date"
  | "cited_eid"
  | "cited_category"
  | "fitness"
  | "citation_count"
  | "citation_count_bin_raw"
  | "fitness_bin_raw"
  | "citation_count_percentile_decile"
  | "fitness_percentile_decile";

export type Aggregation = "COUNT" | "AVG" | "MIN" | "MAX" | "MEDIAN";

export interface ChartConfig {
  x: AxisField;
  groupBy: AxisField[];
  orderDir: "ASC" | "DESC";
  yField: "n_article" | AxisField;
  yAgg: Aggregation;
  fitnessBinSize: number;
  citationCountBinSize: number;
}

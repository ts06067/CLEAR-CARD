/**
 * Fields available in the query builder and chart config.
 * Keep names aligned with columns that exist in the final SELECT (FROM aggregation)
 * or upstream CTEs if used only for filtering.
 */

export type FieldType = "text" | "number" | "date";

export interface FieldDef {
  name: string;     // alias/column name
  label: string;    // human label
  type: FieldType;
}

export const FIELDS: FieldDef[] = [
  // ---- cited (target) ----
  { name: "cited_id",         label: "Cited Paper ID",     type: "number" },
  { name: "cited_eid",        label: "Cited EID",          type: "text" },
  { name: "cited_doi",        label: "Cited DOI",          type: "text" },
  { name: "cited_title",      label: "Cited Title",        type: "text" },
  { name: "cited_journal",    label: "Cited Journal",      type: "text" },
  { name: "cited_pub_date",   label: "Cited Pub Date",     type: "date" },
  { name: "cited_pub_year",   label: "Cited Pub Year",     type: "number" },
  { name: "cited_pub_month",  label: "Cited Pub Month",    type: "number" },
  { name: "cited_pub_day",    label: "Cited Pub Day",      type: "number" },

  // ---- citing (source) ----
  { name: "citing_id",        label: "Citing Paper ID",    type: "number" },
  { name: "citing_eid",       label: "Citing EID",         type: "text" },
  { name: "citing_doi",       label: "Citing DOI",         type: "text" },
  { name: "citing_title",     label: "Citing Title",       type: "text" },
  { name: "citing_journal",   label: "Citing Journal",     type: "text" },
  { name: "citing_pub_date",  label: "Citing Pub Date",    type: "date" },
  { name: "citing_pub_year",  label: "Citing Pub Year",    type: "number" },
  { name: "citing_pub_month", label: "Citing Pub Month",   type: "number" },
  { name: "citing_pub_day",   label: "Citing Pub Day",     type: "number" },

  // ---- derived (from condition / aggregation CTEs) ----
  { name: "citation_time_days",                label: "Citation Lag (days)",              type: "number" },
  { name: "cited_category",                    label: "Cited Category",                   type: "text"   },
  { name: "fitness",                           label: "Fitness (per cited_eid)",          type: "number" },
  { name: "citation_count",                    label: "Citation Count (per cited_eid)",   type: "number" },
  { name: "citation_count_bin_raw",            label: "Citation Count Bin (raw)",         type: "number" },
  { name: "fitness_bin_raw",                   label: "Fitness Bin (raw)",                type: "number" },
  { name: "citation_count_percentile_decile",  label: "Citation Count Percentile (decile)", type: "number" },
  { name: "fitness_percentile_decile",         label: "Fitness Percentile (decile)",      type: "number" }
];

export function isNumericField(name: string): boolean {
  const f = FIELDS.find((x) => x.name === name);
  return f?.type === "number";
}

export function isDateField(name: string): boolean {
  const f = FIELDS.find((x) => x.name === name);
  return f?.type === "date";
}

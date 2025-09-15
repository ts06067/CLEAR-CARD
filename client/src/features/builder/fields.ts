import type {
  Field,
  Operator,
  ValueEditorType,
  InputType
} from "react-querybuilder";

export type FieldKey =
  | "cited_journal"
  | "cited_title"
  | "cited_eid"
  | "cited_category"
  | "cited_pub_year"
  | "cited_pub_month"
  | "cited_pub_day"
  | "cited_pub_date"
  | "fitness"
  | "citation_count"
  | "citation_count_bin_raw"
  | "fitness_bin_raw"
  | "citation_count_percentile_decile"
  | "fitness_percentile_decile"
  | "citation_time_days";

export const STRING_FIELDS: FieldKey[] = [
  "cited_journal",
  "cited_title",
  "cited_eid",
  "cited_category"
];
export const NUM_FIELDS: FieldKey[] = [
  "cited_pub_year",
  "cited_pub_month",
  "cited_pub_day",
  "fitness",
  "citation_count",
  "citation_count_bin_raw",
  "fitness_bin_raw",
  "citation_count_percentile_decile",
  "fitness_percentile_decile",
  "citation_time_days"
];
export const DATE_FIELDS: FieldKey[] = ["cited_pub_date"];

const makeTextField = (name: FieldKey): Field => ({
  name,
  label: name,
  valueEditorType: "text" as ValueEditorType
});

const makeNumberField = (name: FieldKey): Field => ({
  name,
  label: name,
  valueEditorType: "text" as ValueEditorType,
  inputType: "number" as InputType
});

const makeDateField = (name: FieldKey): Field => ({
  name,
  label: name,
  valueEditorType: "text" as ValueEditorType,
  inputType: "date" as InputType
});

export const fields: Field[] = [
  ...STRING_FIELDS.map(makeTextField),
  ...NUM_FIELDS.map(makeNumberField),
  ...DATE_FIELDS.map(makeDateField)
];

export const stringOperators: Operator[] = [
  { name: "=", label: "EXACTLY" },
  { name: "!=", label: "NOT EXACTLY" },
  { name: "contains", label: "CONTAINS" },
  { name: "doesNotContain", label: "NOT CONTAIN" },
  { name: "beginsWith", label: "START WITH" },
  { name: "endsWith", label: "END WITH" }
];

export const numberOperators: Operator[] = [
  { name: ">", label: ">" },
  { name: ">=", label: ">=" },
  { name: "<", label: "<" },
  { name: "<=", label: "<=" },
  { name: "=", label: "==" },
  { name: "!=", label: "!=" },
  { name: "between", label: "BETWEEN" }
];

export const dateOperators: Operator[] = [
  { name: "=", label: "==" },
  { name: ">=", label: ">=" },
  { name: "<=", label: "<=" },
  { name: "between", label: "BETWEEN" }
];

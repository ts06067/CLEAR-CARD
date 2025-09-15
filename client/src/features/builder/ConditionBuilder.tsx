import { QueryBuilder, defaultOperators } from "react-querybuilder";
import type {
  Field,
  RuleGroupType,
  Operator,
  OptionList
} from "react-querybuilder";
import "react-querybuilder/dist/query-builder.css";

import {
  fields,
  stringOperators,
  numberOperators,
  dateOperators,
  STRING_FIELDS,
  NUM_FIELDS,
  DATE_FIELDS
} from "./fields";

export type ConditionQuery = RuleGroupType;

export default function ConditionBuilder({
  query,
  onChange
}: {
  query: ConditionQuery;
  onChange: (q: ConditionQuery) => void;
}) {
  // v7/8 signature: (fieldName, { fieldData })
  const getOperators = (
    _fieldName: string,
    { fieldData }: { fieldData?: Field }
  ): OptionList<Operator> | null => {
    if (!fieldData) return null;
    const name = fieldData.name as any;

    if (STRING_FIELDS.includes(name)) return stringOperators;
    if (NUM_FIELDS.includes(name)) return numberOperators;
    if (DATE_FIELDS.includes(name)) return dateOperators;

    return defaultOperators;
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-white">
      <div className="px-3 py-2 font-medium text-brand">Conditions</div>
      <div className="p-3">
        <QueryBuilder
          fields={fields}
          query={query}
          onQueryChange={onChange}
          getOperators={getOperators}
          controlClassnames={{ queryBuilder: "rqb-compact" }}
        />
      </div>
    </div>
  );
}

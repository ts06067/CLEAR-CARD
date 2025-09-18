import { QueryBuilder } from "react-querybuilder";
import type { RuleGroupType } from "react-querybuilder";
import "react-querybuilder/dist/query-builder.css";
import { FIELDS } from "./fields";

/** Map our field list to RQB fields */
const RB_FIELDS: any[] = FIELDS.map(f => ({
  name: f.name,
  label: f.label,
  valueEditorType: f.type === "number" ? "number" : f.type === "date" ? "date" : "text"
}));

/** Operator lists */
const TEXT_OPS: any[] = [
  { name: "contains", label: "contains" },
  { name: "doesNotContain", label: "does not contain" },
  { name: "beginsWith", label: "begins with" },
  { name: "endsWith", label: "ends with" },
  { name: "=", label: "=" },
  { name: "!=", label: "!=" },
  { name: "in", label: "in" },
  { name: "notIn", label: "not in" },
  { name: "isNull", label: "is null" },
  { name: "isNotNull", label: "is not null" }
];

const NUM_OPS: any[] = [
  { name: "=", label: "=" },
  { name: "!=", label: "!=" },
  { name: ">", label: ">" },
  { name: ">=", label: ">=" },
  { name: "<", label: "<" },
  { name: "<=", label: "<=" },
  { name: "between", label: "between" },
  { name: "notBetween", label: "not between" },
  { name: "in", label: "in" },
  { name: "notIn", label: "not in" },
  { name: "isNull", label: "is null" },
  { name: "isNotNull", label: "is not null" }
];

const DATE_OPS: any[] = [
  { name: "=", label: "=" },
  { name: "!=", label: "!=" },
  { name: ">", label: "after" },
  { name: "<", label: "before" },
  { name: "between", label: "between" },
  { name: "isNull", label: "is null" },
  { name: "isNotNull", label: "is not null" }
];

function operatorsForField(fieldName?: string): any[] {
  const f = FIELDS.find(x => x.name === fieldName);
  if (!f) return TEXT_OPS;
  if (f.type === "number") return NUM_OPS;
  if (f.type === "date") return DATE_OPS;
  return TEXT_OPS;
}

/** Custom editors/selectors kept loose for RQB v8 compatibility */
function TailwindValueEditor(props: any) {
  const { field, operator, value, handleOnChange } = props;
  const f = FIELDS.find((x) => x.name === field);

  if (operator === "isNull" || operator === "isNotNull") return <span className="text-slate-500 text-sm">—</span>;

  if (operator === "between" || operator === "notBetween") {
    const [a, b] = Array.isArray(value) ? value : ["", ""];
    return (
      <div className="flex items-center gap-2">
        <input
          className="input"
          type={f?.type === "number" ? "number" : f?.type === "date" ? "date" : "text"}
          value={String(a ?? "")}
          onChange={e => handleOnChange([e.target.value, b])}
        />
        <span className="text-xs text-slate-500">and</span>
        <input
          className="input"
          type={f?.type === "number" ? "number" : f?.type === "date" ? "date" : "text"}
          value={String(b ?? "")}
          onChange={e => handleOnChange([a, e.target.value])}
        />
      </div>
    );
  }

  if (operator === "in" || operator === "notIn") {
    return (
      <input
        className="input w-64"
        placeholder="val1, val2, …"
        value={value ?? ""}
        onChange={e => handleOnChange(e.target.value)}
      />
    );
  }

  return (
    <input
      className="input"
      type={f?.type === "number" ? "number" : f?.type === "date" ? "date" : "text"}
      value={value ?? ""}
      onChange={e => handleOnChange(e.target.value)}
    />
  );
}

function TailwindFieldSelector(props: any) {
  const { options, value, handleOnChange } = props;

  // Flatten possible option groups to simple array
  const flat: { name: string; label: string }[] = [];
  (options ?? []).forEach((o: any) => {
    if (o?.options) {
      o.options.forEach((x: any) => flat.push({ name: x.name, label: x.label }));
    } else if (o?.name) {
      flat.push({ name: o.name, label: o.label });
    }
  });

  return (
    <select className="select" value={value} onChange={e => handleOnChange(e.target.value)}>
      {flat.map(o => (
        <option key={o.name} value={o.name}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export default function ConditionBuilder({
  query,
  onChange
}: {
  query: RuleGroupType;
  onChange: (g: RuleGroupType) => void;
}) {
  return (
    <div className="card">
      <div className="card-h">Conditions</div>
      <div className="card-b space-y-3">
        <QueryBuilder
          fields={RB_FIELDS as any}
          query={query}
          onQueryChange={onChange}
          controlElements={{
            valueEditor: TailwindValueEditor,
            fieldSelector: TailwindFieldSelector
          }}
          // IMPORTANT: react-querybuilder passes the field **name (string)** here,
          // not an object — handle both signatures.
          getOperators={(f: any) => operatorsForField(typeof f === "string" ? f : f?.name)}
          // Reset operator/value when field or operator changes, so the UI reflects the new operator set.
          resetOnFieldChange
          resetOnOperatorChange
          showCombinatorsBetweenRules
          addRuleToNewGroups
        />

        <details className="text-xs text-slate-500">
          <summary className="cursor-pointer select-none">Debug JSON</summary>
          <pre className="bg-slate-50 p-2 rounded overflow-auto">{JSON.stringify(query, null, 2)}</pre>
        </details>
      </div>
    </div>
  );
}

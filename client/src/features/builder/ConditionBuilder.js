import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { QueryBuilder } from "react-querybuilder";
import "react-querybuilder/dist/query-builder.css";
import { motion } from "framer-motion";
import { Plus, Rows, X } from "lucide-react";
import { FIELDS } from "./fields";
/* ========================== field & operator wiring ========================== */
const RB_FIELDS = FIELDS.map((f) => ({
    name: f.name,
    label: f.label,
    valueEditorType: f.type === "number" ? "number" : f.type === "date" ? "date" : "text",
}));
const TEXT_OPS = [
    { name: "contains", label: "contains" },
    { name: "doesNotContain", label: "does not contain" },
    { name: "beginsWith", label: "begins with" },
    { name: "endsWith", label: "ends with" },
    { name: "=", label: "=" },
    { name: "!=", label: "!=" },
    { name: "in", label: "in" },
    { name: "notIn", label: "not in" },
    { name: "isNull", label: "is null" },
    { name: "isNotNull", label: "is not null" },
];
const NUM_OPS = [
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
    { name: "isNotNull", label: "is not null" },
];
const DATE_OPS = [
    { name: "=", label: "=" },
    { name: "!=", label: "!=" },
    { name: ">", label: "after" },
    { name: "<", label: "before" },
    { name: "between", label: "between" },
    { name: "isNull", label: "is null" },
    { name: "isNotNull", label: "is not null" },
];
function operatorsForField(fieldName) {
    const f = FIELDS.find((x) => x.name === fieldName);
    if (!f)
        return TEXT_OPS;
    if (f.type === "number")
        return NUM_OPS;
    if (f.type === "date")
        return DATE_OPS;
    return TEXT_OPS;
}
/* ====================== compact Tailwind “atoms” ====================== */
const clsInput = "border rounded-lg px-2.5 py-1.5 text-sm outline-none " +
    "focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 " +
    "transition-shadow duration-150";
const clsSelect = "border rounded-lg px-2.5 py-1.5 text-sm outline-none bg-white " +
    "focus:ring-2 focus:ring-sky-200 focus:border-sky-400 " +
    "transition-shadow duration-150";
/* ---------------- value editor ---------------- */
function TailwindValueEditor(props) {
    const { field, operator, value, handleOnChange } = props;
    const f = FIELDS.find((x) => x.name === field);
    if (operator === "isNull" || operator === "isNotNull") {
        return _jsx("span", { className: "text-slate-500 text-sm", children: "\u2014" });
    }
    if (operator === "between" || operator === "notBetween") {
        const [a, b] = Array.isArray(value) ? value : ["", ""];
        const type = f?.type === "number" ? "number" : f?.type === "date" ? "date" : "text";
        return (_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("input", { className: clsInput, type: type, value: String(a ?? ""), onChange: (e) => handleOnChange([e.target.value, b]) }), _jsx("span", { className: "px-1.5 py-0.5 text-xs rounded-full bg-slate-100 text-slate-600 border", children: "and" }), _jsx("input", { className: clsInput, type: type, value: String(b ?? ""), onChange: (e) => handleOnChange([a, e.target.value]) })] }));
    }
    if (operator === "in" || operator === "notIn") {
        return (_jsx("input", { className: `${clsInput} w-64`, placeholder: "val1, val2, \u2026", value: value ?? "", onChange: (e) => handleOnChange(e.target.value) }));
    }
    const type = f?.type === "number" ? "number" : f?.type === "date" ? "date" : "text";
    return (_jsx("input", { className: clsInput, type: type, value: value ?? "", onChange: (e) => handleOnChange(e.target.value) }));
}
/* ---------------- field selector ---------------- */
function TailwindFieldSelector(props) {
    const { options, value, handleOnChange } = props;
    const flat = [];
    (options ?? []).forEach((o) => {
        if (o?.options)
            o.options.forEach((x) => flat.push({ name: x.name, label: x.label }));
        else if (o?.name)
            flat.push({ name: o.name, label: o.label });
    });
    return (_jsx("select", { className: clsSelect, value: value, onChange: (e) => handleOnChange(e.target.value), children: flat.map((o) => (_jsx("option", { value: o.name, children: o.label }, o.name))) }));
}
function IconBtn({ icon, label, tone = "indigo", onClick, dense, }) {
    const tones = {
        indigo: "text-indigo-700 border-indigo-200 hover:bg-indigo-50 active:bg-indigo-100 focus:ring-indigo-200",
        sky: "text-sky-700 border-sky-200 hover:bg-sky-50 active:bg-sky-100 focus:ring-sky-200",
        rose: "text-rose-700 border-rose-200 hover:bg-rose-50 active:bg-rose-100 focus:ring-rose-200",
    };
    const pad = dense ? "px-2.5 py-1" : "px-3 py-1.5";
    return (_jsxs("button", { type: "button", onClick: onClick, className: `inline-flex items-center gap-1.5 rounded-lg border ${pad} bg-white text-sm font-medium transition-colors
        focus:outline-none focus:ring-2 ${tones[tone]} shadow-sm`, children: [icon, label && _jsx("span", { className: "select-none", children: label })] }));
}
/**
 * Add / Remove actions for RQB  (custom control elements)
 * RQB calls these with props { handleOnClick } etc.
 */
function AddRuleAction(props) {
    return _jsx(IconBtn, { icon: _jsx(Plus, { className: "h-4 w-4" }), label: "Add Rule", tone: "indigo", onClick: props.handleOnClick });
}
function AddGroupAction(props) {
    return _jsx(IconBtn, { icon: _jsx(Rows, { className: "h-4 w-4" }), label: "Add Group", tone: "sky", onClick: props.handleOnClick });
}
function RemoveAction(props) {
    return _jsx(IconBtn, { icon: _jsx(X, { className: "h-4 w-4" }), tone: "rose", dense: true, onClick: props.handleOnClick });
}
/* ============================ component ============================ */
export default function ConditionBuilder({ query, onChange, }) {
    return (_jsxs(motion.div, { initial: { opacity: 0, y: 6 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.18 }, 
        // global typography and selection
        className: "rounded-2xl border bg-white shadow-sm overflow-hidden select-none font-sans antialiased", style: { WebkitFontSmoothing: "antialiased", MozOsxFontSmoothing: "grayscale" }, children: [_jsx("div", { className: "px-4 py-2.5 border-b bg-gradient-to-r from-slate-50 to-white", children: _jsx("span", { className: "text-sm font-medium text-slate-700", children: "Conditions" }) }), _jsxs("div", { className: "p-3 space-y-2", children: [_jsx(QueryBuilder, { fields: RB_FIELDS, query: query, onQueryChange: onChange, controlElements: {
                            valueEditor: TailwindValueEditor,
                            fieldSelector: TailwindFieldSelector,
                            addRuleAction: AddRuleAction,
                            addGroupAction: AddGroupAction,
                            removeRuleAction: RemoveAction,
                            removeGroupAction: RemoveAction,
                        }, getOperators: (f) => operatorsForField(typeof f === "string" ? f : f?.name), resetOnFieldChange: true, resetOnOperatorChange: true, showCombinatorsBetweenRules: true, addRuleToNewGroups: true, controlClassnames: {
                            queryBuilder: "rqbe w-full",
                            ruleGroup: "rounded-xl border bg-indigo-50/40 p-3 shadow-[inset_0_0_0_1px_rgba(99,102,241,.15)]",
                            rule: "rounded-lg border bg-white p-2 shadow-sm",
                            combinators: `${clsSelect} bg-white`,
                            notToggle: "ml-2",
                            fields: clsSelect,
                            operators: clsSelect,
                            value: clsInput,
                        } }), _jsxs("details", { className: "mt-1 text-xs text-slate-500", children: [_jsx("summary", { className: "cursor-pointer select-none hover:text-slate-700 transition-colors", children: "Debug JSON" }), _jsx("pre", { className: "bg-slate-50 p-2 rounded-lg overflow-auto shadow-inner", children: JSON.stringify(query, null, 2) })] })] })] }));
}

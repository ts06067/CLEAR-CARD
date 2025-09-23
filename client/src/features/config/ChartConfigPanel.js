import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo, useState } from "react";
//import { motion } from "motion/react";
import { axisCandidates, COUNT_SENTINEL, numericCandidates, validYField } from "./chartConfig";
import { FIELDS } from "../builder/fields";
export default function ChartConfigPanel({ cfg, onChange }) {
    const [groupInput, setGroupInput] = useState("");
    const addGroup = () => {
        if (!groupInput)
            return;
        if (!cfg.groupBy.includes(groupInput)) {
            onChange({ ...cfg, groupBy: [...cfg.groupBy, groupInput] });
        }
        setGroupInput("");
    };
    const removeGroup = (g) => onChange({ ...cfg, groupBy: cfg.groupBy.filter(x => x !== g) });
    const yFieldList = useMemo(() => [COUNT_SENTINEL, ...numericCandidates], []);
    const onYFieldChange = (v) => {
        if (!validYField(v, cfg.yAgg)) {
            onChange({ ...cfg, yField: v, yAgg: "COUNT" });
        }
        else {
            onChange({ ...cfg, yField: v });
        }
    };
    const onYaggChange = (v) => {
        if (!validYField(cfg.yField, v)) {
            onChange({ ...cfg, yAgg: v, yField: COUNT_SENTINEL });
        }
        else {
            onChange({ ...cfg, yAgg: v });
        }
    };
    return (_jsxs("div", { className: "card", children: [_jsx("div", { className: "card-h", children: "Chart & Grouping" }), _jsxs("div", { className: "card-b space-y-4", children: [_jsxs("div", { className: "grid grid-cols-1 sm:grid-cols-2 gap-3", children: [_jsxs("div", { children: [_jsx("label", { className: "text-sm font-medium", children: "X axis" }), _jsx("select", { className: "select w-full mt-1", value: cfg.x, onChange: (e) => onChange({ ...cfg, x: e.target.value }), children: axisCandidates.map(n => _jsx("option", { value: n, children: labelOf(n) }, n)) })] }), _jsxs("div", { children: [_jsx("label", { className: "text-sm font-medium", children: "Order by Y" }), _jsxs("select", { className: "select w-full mt-1", value: cfg.orderDir, onChange: (e) => onChange({ ...cfg, orderDir: e.target.value }), children: [_jsx("option", { value: "ASC", children: "Ascending" }), _jsx("option", { value: "DESC", children: "Descending" })] })] }), _jsxs("div", { children: [_jsx("label", { className: "text-sm font-medium", children: "Y aggregate" }), _jsxs("select", { className: "select w-full mt-1", value: cfg.yAgg, onChange: (e) => onYaggChange(e.target.value), children: [_jsx("option", { value: "COUNT", children: "COUNT" }), _jsx("option", { value: "AVG", children: "AVG" }), _jsx("option", { value: "MIN", children: "MIN" }), _jsx("option", { value: "MAX", children: "MAX" }), _jsx("option", { value: "MEDIAN", children: "MEDIAN" })] })] }), _jsxs("div", { children: [_jsx("label", { className: "text-sm font-medium", children: "Y field" }), _jsx("select", { className: "select w-full mt-1", value: cfg.yField, onChange: (e) => onYFieldChange(e.target.value), children: yFieldList.map(n => _jsx("option", { value: n, children: n === COUNT_SENTINEL ? "COUNT(*)" : labelOf(n) }, n)) }), cfg.yField !== COUNT_SENTINEL && cfg.yAgg === "COUNT" && (_jsx("div", { className: "text-xs text-slate-500 mt-1", children: "COUNT selected because Y field is non-numeric." }))] })] }), _jsxs("div", { children: [_jsx("label", { className: "text-sm font-medium", children: "Group by (series)" }), _jsxs("div", { className: "flex items-center gap-2 mt-1", children: [_jsxs("select", { className: "select", value: groupInput, onChange: (e) => setGroupInput(e.target.value), children: [_jsx("option", { value: "", children: "\u2014 pick a field \u2014" }), axisCandidates.map(n => _jsx("option", { value: n, children: labelOf(n) }, n))] }), _jsx("button", { className: "btn btn-ghost", onClick: addGroup, children: "Add" })] }), _jsxs("div", { className: "flex flex-wrap gap-2 mt-2", children: [cfg.groupBy.map(g => (_jsxs("span", { className: "px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-xs", children: [labelOf(g), " ", _jsx("button", { className: "ml-1 text-slate-500 hover:text-slate-700", onClick: () => removeGroup(g), children: "\u00D7" })] }, g))), cfg.groupBy.length === 0 && (_jsx("span", { className: "text-xs text-slate-500", children: "No grouping (single series)" }))] })] }), _jsxs("div", { className: "grid grid-cols-1 sm:grid-cols-2 gap-3", children: [_jsxs("div", { children: [_jsx("label", { className: "text-sm font-medium", children: "Fitness bin size" }), _jsx("input", { className: "input w-full mt-1", type: "number", step: "0.1", value: cfg.fitnessBinSize, onChange: (e) => onChange({ ...cfg, fitnessBinSize: Number(e.target.value) }) })] }), _jsxs("div", { children: [_jsx("label", { className: "text-sm font-medium", children: "Citation count bin size" }), _jsx("input", { className: "input w-full mt-1", type: "number", step: "0.1", value: cfg.citationCountBinSize, onChange: (e) => onChange({ ...cfg, citationCountBinSize: Number(e.target.value) }) })] })] })] })] }));
}
function labelOf(name) {
    return FIELDS.find(f => f.name === name)?.label ?? name;
}

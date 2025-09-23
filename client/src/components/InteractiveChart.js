import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React, { memo, useEffect, useMemo, useState } from "react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, Legend, BarChart, Bar, CartesianGrid, ScatterChart, Scatter, PieChart, Pie, Cell, } from "recharts";
/* ---------------- Palette & helpers ---------------- */
const PALETTE = [
    "#4f46e5", "#10b981", "#f59e0b", "#ef4444", "#06b6d4",
    "#8b5cf6", "#84cc16", "#ec4899", "#14b8a6", "#f97316",
];
const toUpper = (v) => (typeof v === "string" ? v.toUpperCase() : v ?? "");
const seriesName = (name, key) => toUpper(name ?? key ?? "");
const legendFormatter = (value) => toUpper(String(value));
const isNumeric = (v) => {
    const n = Number(v);
    return !Number.isNaN(n) && Number.isFinite(n);
};
function sumBy(arr, fn) {
    let s = 0;
    for (const t of arr) {
        const n = Number(fn(t));
        if (!Number.isNaN(n) && Number.isFinite(n))
            s += n;
    }
    return s;
}
function minMax(nums) {
    if (!nums.length)
        return { min: 0, max: 1 };
    let mn = nums[0], mx = nums[0];
    for (let i = 1; i < nums.length; i++) {
        const v = nums[i];
        if (typeof v === "number") {
            if (v < mn)
                mn = v;
            if (v > mx)
                mx = v;
        }
    }
    if (mn === mx) {
        // pad a tiny range so axes render nicely
        mn = mn - 1;
        mx = mx + 1;
    }
    return { min: mn, max: mx };
}
function axisLabel(value, isY) {
    if (!value)
        return undefined;
    return isY
        ? { value: toUpper(value), angle: -90, position: "insideLeft", offset: 8 }
        : { value: toUpper(value), position: "insideBottom", offset: -2 };
}
/* ---------------- Error boundary ---------------- */
class ChartErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false };
    }
    static getDerivedStateFromError() {
        return { hasError: true };
    }
    componentDidCatch() { }
    render() {
        if (this.state.hasError) {
            return (this.props.fallback ?? (_jsx("div", { className: "w-full h-full flex items-center justify-center text-sm text-slate-500", children: "Unable to render chart." })));
        }
        return this.props.children;
    }
}
/* ---------------- Small UI atoms ---------------- */
function Radio({ name, value, current, onChange, label, }) {
    return (_jsxs("label", { className: "inline-flex items-center gap-1.5 cursor-pointer select-none", children: [_jsx("input", { type: "radio", name: name, value: value, checked: current === value, onChange: () => onChange(value), className: "accent-indigo-600" }), _jsx("span", { className: "text-sm capitalize", children: label })] }));
}
function RangeControls({ label, auto, setAuto, min, max, setMin, setMax, defaults, disabled, }) {
    return (_jsxs("div", { className: `flex items-center gap-2 ${disabled ? "opacity-50 pointer-events-none" : ""}`, children: [_jsx("span", { className: "text-sm text-slate-600 w-6", children: label }), _jsxs("label", { className: "inline-flex items-center gap-1 text-sm", children: [_jsx("input", { type: "checkbox", checked: auto, onChange: (e) => setAuto(e.target.checked), className: "accent-indigo-600" }), _jsx("span", { children: "Auto" })] }), _jsx("input", { type: "number", className: "border rounded px-2 py-1 text-sm w-28", value: auto ? defaults.min : (min ?? defaults.min), onChange: (e) => setMin(e.target.value === "" ? undefined : Number(e.target.value)), disabled: auto }), _jsx("span", { className: "text-xs text-slate-500", children: "to" }), _jsx("input", { type: "number", className: "border rounded px-2 py-1 text-sm w-28", value: auto ? defaults.max : (max ?? defaults.max), onChange: (e) => setMax(e.target.value === "" ? undefined : Number(e.target.value)), disabled: auto }), !auto && (_jsx("button", { type: "button", className: "ml-1 px-2 py-1 rounded border text-xs hover:bg-slate-50", onClick: () => { setMin(undefined); setMax(undefined); setAuto(true); }, children: "Reset" }))] }));
}
/* ---------------- Main component ---------------- */
function InteractiveChart({ defaultKind = "line", data, xKey, yKeys, xLabel, yLabel, }) {
    /* hooks (always stable) */
    const [kind, setKind] = useState(defaultKind);
    const safeData = useMemo(() => (Array.isArray(data) ? data : []), [data]);
    const hasSeries = !!(yKeys && yKeys.length);
    // Numeric detection for X
    const xNums = useMemo(() => safeData.map((d) => Number(d?.[xKey])).filter(isNumeric), [safeData, xKey]);
    const numericX = xNums.length === safeData.length && safeData.length > 0;
    // All Y values across series (for default Y range)
    const yNums = useMemo(() => {
        const acc = [];
        for (const yk of yKeys) {
            for (const d of safeData) {
                const v = Number(d?.[yk.key]);
                if (isNumeric(v))
                    acc.push(v);
            }
        }
        return acc;
    }, [safeData, yKeys]);
    // Default domains from data
    const xDefaults = useMemo(() => minMax(xNums), [xNums]);
    const yDefaults = useMemo(() => minMax(yNums), [yNums]);
    // User-adjustable domain states (undefined => auto/dataMin/dataMax)
    const [xAuto, setXAuto] = useState(true);
    const [yAuto, setYAuto] = useState(true);
    const [xMin, setXMin] = useState(undefined);
    const [xMax, setXMax] = useState(undefined);
    const [yMin, setYMin] = useState(undefined);
    const [yMax, setYMax] = useState(undefined);
    // When data changes, if on Auto, keep following defaults
    useEffect(() => {
        if (xAuto) {
            setXMin(undefined);
            setXMax(undefined);
        }
        if (yAuto) {
            setYMin(undefined);
            setYMax(undefined);
        }
    }, [xDefaults, yDefaults, xAuto, yAuto]);
    // Derived sanitized series for scatter
    const scatterSeries = useMemo(() => {
        return yKeys.map((yk) => {
            const pts = safeData
                .map((d) => ({ x: d?.[xKey], y: d?.[yk.key] }))
                .filter((p) => isNumeric(p.x) && isNumeric(p.y))
                .map((p) => ({ x: Number(p.x), y: Number(p.y) }));
            return { key: yk.key, name: seriesName(yk.name, yk.key), points: pts };
        });
    }, [safeData, xKey, yKeys]);
    // Pie slices
    const pieData = useMemo(() => {
        const slices = yKeys.map((yk) => ({
            name: seriesName(yk.name, yk.key),
            value: sumBy(safeData, (d) => Number(d?.[yk.key])),
        }));
        const total = sumBy(slices, (s) => s.value);
        if (!Number.isFinite(total) || total === 0)
            return [{ name: "TOTAL", value: 0 }];
        return slices;
    }, [safeData, yKeys]);
    const lineBarMargins = { top: 10, right: 30, bottom: 32, left: 10 };
    const scatterMargins = { top: 10, right: 30, bottom: 32, left: 10 };
    // Build exactly ONE chart element for ResponsiveContainer
    const chartEl = useMemo(() => {
        // Domains: for numeric axes => either user values or dataMin/dataMax
        const xDomain = numericX
            ? [xAuto ? "dataMin" : (xMin ?? xDefaults.min), xAuto ? "dataMax" : (xMax ?? xDefaults.max)]
            : undefined;
        const yDom = [yAuto ? "auto" : (yMin ?? yDefaults.min), yAuto ? "auto" : (yMax ?? yDefaults.max)];
        switch (kind) {
            case "line":
                return (_jsxs(LineChart, { data: safeData, margin: lineBarMargins, children: [_jsx(CartesianGrid, { strokeDasharray: "3 3" }), _jsx(XAxis, { dataKey: xKey, type: numericX ? "number" : "category", domain: numericX ? xDomain : undefined, label: axisLabel(xLabel) }), _jsx(YAxis, { domain: yDom, label: axisLabel(yLabel, true) }), _jsx(Tooltip, { isAnimationActive: false }), _jsx(Legend, { formatter: legendFormatter }), yKeys.map((k, i) => (_jsx(Line, { type: "monotone", dataKey: k.key, name: seriesName(k.name, k.key), dot: false, strokeWidth: 2, stroke: PALETTE[i % PALETTE.length], isAnimationActive: false, connectNulls: true }, k.key)))] }));
            case "bar":
                return (_jsxs(BarChart, { data: safeData, margin: lineBarMargins, children: [_jsx(CartesianGrid, { strokeDasharray: "3 3" }), _jsx(XAxis, { dataKey: xKey, type: numericX ? "number" : "category", domain: numericX ? xDomain : undefined, label: axisLabel(xLabel) }), _jsx(YAxis, { domain: yDom, label: axisLabel(yLabel, true) }), _jsx(Tooltip, { isAnimationActive: false }), _jsx(Legend, { formatter: legendFormatter }), yKeys.map((k, i) => (_jsx(Bar, { dataKey: k.key, name: seriesName(k.name, k.key), fill: PALETTE[i % PALETTE.length], isAnimationActive: false }, k.key)))] }));
            case "scatter":
                return (_jsxs(ScatterChart, { margin: scatterMargins, children: [_jsx(CartesianGrid, { strokeDasharray: "3 3" }), _jsx(XAxis, { dataKey: "x", type: numericX ? "number" : "category", domain: numericX ? xDomain : undefined, name: toUpper(xLabel ?? xKey), label: axisLabel(xLabel) }), _jsx(YAxis, { dataKey: "y", type: "number", domain: yDom, name: toUpper(yLabel ?? "value"), label: axisLabel(yLabel, true) }), _jsx(Tooltip, { isAnimationActive: false, cursor: { strokeDasharray: "3 3" } }), _jsx(Legend, { formatter: legendFormatter }), scatterSeries.map((s, i) => (_jsx(Scatter, { name: s.name, data: s.points, fill: PALETTE[i % PALETTE.length], isAnimationActive: false }, s.key)))] }));
            case "pie":
            default:
                return (_jsxs(PieChart, { children: [_jsx(Tooltip, { isAnimationActive: false }), _jsx(Legend, { formatter: legendFormatter }), _jsx(Pie, { data: pieData, dataKey: "value", nameKey: "name", isAnimationActive: false, innerRadius: "45%", outerRadius: "80%", paddingAngle: 1, children: pieData.map((_, i) => (_jsx(Cell, { fill: PALETTE[i % PALETTE.length] }, i))) })] }));
        }
    }, [
        kind,
        safeData,
        yKeys,
        xKey,
        xLabel,
        yLabel,
        numericX,
        xAuto,
        yAuto,
        xMin,
        xMax,
        yMin,
        yMax,
        xDefaults.min,
        xDefaults.max,
        yDefaults.min,
        yDefaults.max,
        scatterSeries,
        pieData,
    ]);
    return (_jsxs("div", { className: "w-full overflow-x-hidden", children: [_jsxs("div", { className: "mb-2 flex flex-wrap items-center gap-4 text-sm", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("span", { className: "text-slate-600", children: "Chart:" }), _jsx(Radio, { name: "chart-kind", value: "line", current: kind, onChange: setKind, label: "line" }), _jsx(Radio, { name: "chart-kind", value: "bar", current: kind, onChange: setKind, label: "bar" }), _jsx(Radio, { name: "chart-kind", value: "scatter", current: kind, onChange: setKind, label: "scatter" }), _jsx(Radio, { name: "chart-kind", value: "pie", current: kind, onChange: setKind, label: "pie" })] }), _jsxs("div", { className: "flex flex-wrap items-center gap-4", children: [kind !== "pie" && numericX && (_jsx(RangeControls, { label: "X", auto: xAuto, setAuto: setXAuto, min: xMin, max: xMax, setMin: setXMin, setMax: setXMax, defaults: xDefaults })), kind !== "pie" && (_jsx(RangeControls, { label: "Y", auto: yAuto, setAuto: setYAuto, min: yMin, max: yMax, setMin: setYMin, setMax: setYMax, defaults: yDefaults, disabled: yNums.length === 0 }))] })] }), _jsx("div", { className: "w-full h-80 overflow-x-hidden rounded-xl bg-white", children: (!safeData.length || !xKey || !hasSeries) ? (_jsx("div", { className: "w-full h-full flex items-center justify-center text-sm text-slate-500", children: "No data" })) : (_jsx(ChartErrorBoundary, { children: _jsx(ResponsiveContainer, { children: chartEl }) })) })] }));
}
export default memo(InteractiveChart);

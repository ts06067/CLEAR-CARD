import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
// client/src/features/job/JobDetailPage.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getJob, getJobStatus, getResultJson } from "../../api/jobs";
import ResultTable from "../../components/ResultTable";
import InteractiveChart from "../../components/InteractiveChart";
import LoadingOverlay from "../../components/LoadingOverlay";
/** number coercion for "123" → 123 */
function asNumber(v) {
    if (typeof v === "number" && Number.isFinite(v))
        return v;
    if (typeof v === "string" && v.trim() !== "") {
        const n = Number(v);
        if (Number.isFinite(n))
            return n;
    }
    return undefined;
}
/** choose a reasonable xKey if cfg missing */
function pickXKey(rows, cfg) {
    const first = rows?.[0];
    if (!first)
        return "x";
    if (cfg?.x && Object.prototype.hasOwnProperty.call(first, cfg.x))
        return cfg.x;
    const prefs = ["cited_pub_year", "cited_pub_date", "cited_pub_month", "cited_pub_day"];
    for (const p of prefs)
        if (Object.prototype.hasOwnProperty.call(first, p))
            return p;
    const keys = Object.keys(first);
    const nonNum = keys.find((k) => asNumber(first[k]) === undefined);
    return nonNum ?? keys[0] ?? "x";
}
/** pick measure column */
function pickMeasureKey(rows, cfg) {
    const first = rows?.[0];
    if (!first)
        return undefined;
    if (cfg) {
        const key = cfg.yAgg === "COUNT" || cfg.yField === "n_article" ? "n_articles" : "y_value";
        if (Object.prototype.hasOwnProperty.call(first, key))
            return key;
    }
    if (Object.prototype.hasOwnProperty.call(first, "n_articles"))
        return "n_articles";
    if (Object.prototype.hasOwnProperty.call(first, "y_value"))
        return "y_value";
    return Object.keys(first).find((k) => asNumber(first[k]) !== undefined);
}
/** build a group label like "JACC · Original" for multi-field grouping */
function makeGroupLabel(row, fields) {
    if (!fields.length)
        return "__single__";
    return fields.map((f) => String(row?.[f] ?? "∅")).join(" · ");
}
export default function JobDetailPage() {
    const { id = "" } = useParams();
    const nav = useNavigate();
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState();
    const [detail, setDetail] = useState();
    const [rows, setRows] = useState([]);
    const [status, setStatus] = useState("PENDING");
    const loadedRef = useRef(false);
    useEffect(() => {
        let alive = true;
        loadedRef.current = false;
        (async () => {
            try {
                const d = await getJob(id);
                if (!alive)
                    return;
                setDetail(d);
                const s = await getJobStatus(id);
                if (!alive)
                    return;
                setStatus(s.state);
                if (s.state === "FAILED") {
                    setErr(s.error || "Job failed");
                }
                else if (s.state === "SUCCEEDED") {
                    const data = await getResultJson(id);
                    if (!alive)
                        return;
                    if (data && Array.isArray(data)) {
                        loadedRef.current = true;
                        setRows(data);
                    }
                }
            }
            catch (e) {
                setErr(e?.message ?? "Failed to load");
            }
            finally {
                setLoading(false);
            }
        })();
        const poll = setInterval(async () => {
            try {
                const s = await getJobStatus(id);
                setStatus(s.state);
                if (s.state === "FAILED") {
                    setErr(s.error || "Job failed");
                    clearInterval(poll);
                    return;
                }
                if (s.state === "SUCCEEDED" && !loadedRef.current) {
                    const data = await getResultJson(id);
                    if (data && Array.isArray(data)) {
                        loadedRef.current = true;
                        setRows(data);
                        clearInterval(poll);
                    }
                }
            }
            catch (_e) {
                console.error("Error polling job status", _e);
            }
        }, 2500);
        return () => {
            alive = false;
            clearInterval(poll);
        };
    }, [id]);
    const cfg = (detail?.config?.cfg ?? null);
    const xKey = useMemo(() => pickXKey(rows, cfg), [rows, cfg]);
    const measureKey = useMemo(() => pickMeasureKey(rows, cfg), [rows, cfg]);
    const { chartData, seriesKeys } = useMemo(() => {
        if (!rows?.length || !measureKey)
            return { chartData: [], seriesKeys: [] };
        const groupFields = (cfg?.groupBy ?? []).filter(Boolean);
        const singleSeries = groupFields.length === 0;
        const xMap = new Map();
        const totals = new Map();
        let hadOther = false;
        for (const r of rows) {
            const xVal = r[xKey];
            const label = singleSeries ? "__single__" : makeGroupLabel(r, groupFields);
            const y = asNumber(r[measureKey]);
            if (y === undefined)
                continue;
            if (!xMap.has(xVal))
                xMap.set(xVal, { [xKey]: xVal });
            const obj = xMap.get(xVal);
            obj[label] = (obj[label] ?? 0) + y;
            totals.set(label, (totals.get(label) ?? 0) + y);
        }
        const limit = Math.max(1, Math.min(12, singleSeries ? 1 : 12));
        let labels = Array.from(totals.entries())
            .sort((a, b) => b[1] - a[1])
            .map(([k]) => k);
        const TOP = labels.slice(0, limit);
        const OTHER = "Other";
        const data = [];
        for (const obj of xMap.values()) {
            let otherSum = 0;
            for (const key of Object.keys(obj)) {
                if (key === xKey)
                    continue;
                if (!TOP.includes(key)) {
                    otherSum += obj[key];
                    delete obj[key];
                }
            }
            if (otherSum > 0) {
                obj[OTHER] = otherSum;
                hadOther = true;
            }
            data.push(obj);
        }
        const finalKeys = singleSeries ? ["__single__"] : hadOther ? [...TOP, OTHER] : TOP;
        if (singleSeries) {
            for (const row of data) {
                if (row.__single__ != null) {
                    row[measureKey] = row.__single__;
                    delete row.__single__;
                }
            }
            return { chartData: data, seriesKeys: [measureKey] };
        }
        return { chartData: data, seriesKeys: finalKeys };
    }, [rows, cfg, xKey, measureKey]);
    const showOverlay = loading || (!loadedRef.current && status !== "FAILED");
    return (_jsxs("div", { className: "p-4 pt-16 space-y-4 overflow-x-hidden", children: [_jsxs("div", { className: "flex items-baseline gap-3", children: [_jsx("button", { className: "px-3 py-1.5 rounded-lg border hover:bg-slate-100", onClick: () => nav(-1), children: "\u2190 Back" }), _jsx("h1", { className: "text-3xl font-extrabold tracking-tight", children: "Job Detail" }), _jsxs("span", { className: "text-slate-500", children: ["#", id] })] }), _jsx(LoadingOverlay, { open: showOverlay, text: "Loading result\u2026" }), err && _jsx("div", { className: "text-red-600", children: err }), detail && (_jsxs("div", { className: "grid grid-cols-12 gap-4", children: [_jsx("div", { className: "col-span-12 lg:col-span-5", children: _jsxs("div", { className: "card", children: [_jsx("div", { className: "card-h", children: "Configuration" }), _jsxs("div", { className: "card-b space-y-2 text-sm", children: [_jsxs("div", { children: [_jsx("span", { className: "font-semibold", children: "Title:" }), " ", detail.title || "-"] }), _jsxs("div", { children: [_jsx("span", { className: "font-semibold", children: "Status:" }), " ", status] }), _jsx("div", { className: "font-semibold", children: "SQL:" }), _jsx("pre", { className: "bg-slate-900 text-slate-100 text-xs rounded p-3 overflow-auto max-h-72", children: detail.sql }), detail.config && (_jsxs(_Fragment, { children: [_jsx("div", { className: "font-semibold", children: "Query Builder" }), _jsx("pre", { className: "bg-slate-50 p-2 rounded text-xs overflow-auto max-h-40", children: JSON.stringify(detail.config.qb, null, 2) }), _jsx("div", { className: "font-semibold", children: "Chart Config" }), _jsx("pre", { className: "bg-slate-50 p-2 rounded text-xs overflow-auto max-h-40", children: JSON.stringify(detail.config.cfg, null, 2) })] }))] })] }) }), _jsxs("div", { className: "col-span-12 lg:col-span-7 space-y-4", children: [_jsxs("div", { className: "card", children: [_jsx("div", { className: "card-h", children: "Result (Table)" }), _jsx("div", { className: "card-b", children: _jsx(ResultTable, { rows: rows }) })] }), _jsxs("div", { className: "card", children: [_jsx("div", { className: "card-h", children: "Result (Interactive Chart)" }), _jsx("div", { className: "card-b", children: chartData.length > 0 && seriesKeys.length > 0 ? (_jsx(InteractiveChart, { defaultKind: "bar", data: chartData, xKey: xKey, yKeys: seriesKeys.map((k) => ({ key: k, name: k })), xLabel: xKey })) : (_jsx("div", { className: "text-sm text-slate-500", children: "No numeric series to plot." })) })] })] })] }))] }));
}

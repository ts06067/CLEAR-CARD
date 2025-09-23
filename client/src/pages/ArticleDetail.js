import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from "react";
import { getArticleCitations, getArticleDetail } from "../api/articles";
import { useNavigate, useParams } from "react-router-dom";
import FullscreenModal from "../components/FullscreenModal";
const toObjs = (cols, rows) => rows.map(r => Object.fromEntries(cols.map((c, i) => [c, r[i] ?? ""])));
function uniqueSortedCounts(values) {
    const map = new Map();
    for (const v of values)
        map.set(v, (map.get(v) || 0) + 1);
    const xs = Array.from(map.keys()).sort((a, b) => a - b);
    const ys = xs.map(x => map.get(x) ?? 0); // Ensure ys is number[]
    return { xs, ys };
}
function ecdfCounts(samples) {
    const { xs, ys } = uniqueSortedCounts(samples);
    const out = [];
    let cum = 0;
    for (let i = 0; i < xs.length; i++) {
        cum += ys[i];
        out.push({ x: xs[i] ?? 0, y: cum });
    }
    return out;
}
function epdfHistogramCounts(samples, binWidth) {
    if (!samples.length)
        return [];
    const max = Math.max(...samples);
    const out = [];
    for (let start = 0; start <= max; start += binWidth) {
        const end = start + binWidth;
        const cnt = samples.filter(v => v >= start && v < end).length;
        out.push({ x: start + binWidth / 2, y: cnt });
    }
    return out;
}
/** Responsive line/area chart — strictly contained; no horizontal overflow */
function LineAreaChart({ data, xKey, yKey, yLabel, fill = true, height = 300, }) {
    const W = 1000; // logical width for scaling
    const H = height;
    const pad = 40, ws = W - pad * 2, hs = H - pad * 2;
    const xs = data.map(d => +d[xKey] || 0);
    const ys = data.map(d => +d[yKey] || 0);
    const maxX = xs.length ? Math.max(...xs) : 1;
    const maxY = ys.length ? Math.max(...ys) : 1;
    const sx = (v) => pad + (maxX ? (v / maxX) * ws : 0);
    const sy = (v) => pad + hs - (maxY ? (v / maxY) * hs : 0);
    const points = data.map(d => `${sx(+d[xKey])},${sy(+d[yKey])}`).join(" ");
    const area = `M ${sx(0)},${sy(0)} L ${points} L ${sx(maxX)},${sy(0)} Z`;
    const gridX = 5, gridY = 4;
    return (_jsxs("div", { className: "w-full overflow-x-hidden", children: [" ", _jsxs("svg", { viewBox: `0 0 ${W} ${H}`, className: "w-full block", style: { height }, children: [_jsx("rect", { x: 0, y: 0, width: W, height: H, rx: 16, fill: "#fff" }), Array.from({ length: gridY + 1 }).map((_, i) => { const y = pad + (i / gridY) * hs; return _jsx("line", { x1: pad, y1: y, x2: pad + ws, y2: y, stroke: "#e5e7eb" }, `gy${i}`); }), Array.from({ length: gridX + 1 }).map((_, i) => { const x = pad + (i / gridX) * ws; return _jsx("line", { x1: x, y1: pad, x2: x, y2: pad + hs, stroke: "#f1f5f9" }, `gx${i}`); }), _jsx("line", { x1: pad, y1: pad + hs, x2: pad + ws, y2: pad + hs, stroke: "#9ca3af" }), _jsx("line", { x1: pad, y1: pad, x2: pad, y2: pad + hs, stroke: "#9ca3af" }), Array.from({ length: gridX + 1 }).map((_, i) => {
                        const x = pad + (i / gridX) * ws;
                        const v = Math.round((i / gridX) * maxX);
                        return _jsxs("g", { children: [_jsx("line", { x1: x, y1: pad + hs, x2: x, y2: pad + hs + 4, stroke: "#9ca3af" }), _jsx("text", { x: x, y: pad + hs + 18, fontSize: "11", textAnchor: "middle", fill: "#6b7280", children: v })] }, `tx${i}`);
                    }), Array.from({ length: gridY + 1 }).map((_, i) => {
                        const y = pad + hs - (i / gridY) * hs;
                        const v = Math.round((i / gridY) * maxY);
                        return _jsxs("g", { children: [_jsx("line", { x1: pad - 4, y1: y, x2: pad, y2: y, stroke: "#9ca3af" }), _jsx("text", { x: pad - 8, y: y + 3, fontSize: "11", textAnchor: "end", fill: "#6b7280", children: v })] }, `ty${i}`);
                    }), fill && _jsx("path", { d: area, fill: "#c7d2fe", opacity: 0.6 }), _jsx("polyline", { fill: "none", stroke: "#4f46e5", strokeWidth: "2.5", points: points }), yLabel && _jsx("text", { x: 12, y: pad + hs / 2, fontSize: "12", textAnchor: "middle", transform: `rotate(-90 12 ${pad + hs / 2})`, fill: "#374151", children: yLabel })] })] }));
}
export default function ArticleDetail() {
    const { eid } = useParams();
    const nav = useNavigate();
    const [detail, setDetail] = useState(null);
    const [cites, setCites] = useState(null);
    const [err, setErr] = useState("");
    const [showEcdf, setShowEcdf] = useState(false);
    const [showEpdf, setShowEpdf] = useState(false);
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const d = await getArticleDetail(eid, { timeoutMs: 120000 });
                if (!cancelled)
                    setDetail(d);
                const c = await getArticleCitations(eid, { timeoutMs: 240000 });
                if (!cancelled)
                    setCites(c);
            }
            catch (e) {
                if (!cancelled)
                    setErr(String(e));
            }
        })();
        return () => { cancelled = true; };
    }, [eid]);
    const citeObjs = useMemo(() => cites ? toObjs(cites.columns, cites.rows) : [], [cites]);
    const times = useMemo(() => citeObjs.map(r => Number(r.citation_time_days)).filter(v => !isNaN(v) && isFinite(v)), [citeObjs]);
    const ecdfData = useMemo(() => ecdfCounts(times).map(d => ({ x: d.x, y: d.y })), [times]);
    const epdfData = useMemo(() => epdfHistogramCounts(times, 30).map(d => ({ x: d.x, y: d.y })), [times]);
    return (_jsxs("div", { className: "p-4 pt-16 space-y-4 overflow-x-hidden", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("button", { className: "px-3 py-1.5 rounded-lg border hover:bg-slate-100", onClick: () => nav(-1), children: "\u2190 Back" }), _jsx("h1", { className: "text-3xl font-extrabold tracking-tight", children: "Article Detail" })] }), _jsx("div", { className: "rounded-2xl border bg-white shadow-sm p-4 space-y-2", children: !detail ? (_jsx("div", { children: "Loading..." })) : (_jsxs(_Fragment, { children: [_jsx("h2", { className: "text-lg font-semibold leading-snug", children: detail.cited_title }), _jsxs("div", { className: "flex flex-wrap items-center gap-3 text-sm text-gray-700", children: [detail.cited_doi && (_jsx("a", { className: "inline-flex items-center gap-1 text-indigo-600 underline", href: `https://doi.org/${detail.cited_doi}`, target: "_blank", rel: "noreferrer", children: "DOI" })), _jsx("span", { className: "px-2 py-0.5 rounded-full bg-gray-100", children: detail.cited_journal }), _jsx("span", { className: "px-2 py-0.5 rounded-full bg-gray-100", children: detail.cited_pub_date }), _jsxs("span", { className: "px-2 py-0.5 rounded-full bg-violet-100 text-violet-700", children: ["Category: ", detail.cited_category ?? "-"] }), _jsxs("span", { className: "px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700", children: ["Fitness: ", detail.fitness ?? "-"] }), _jsxs("span", { className: "px-2 py-0.5 rounded-full bg-blue-100 text-blue-700", children: ["2y citations: ", detail.citation_count_2y ?? "-"] })] })] })) }), _jsxs("div", { className: "grid md:grid-cols-2 gap-6", children: [_jsxs("div", { className: "rounded-2xl border bg-white shadow-sm", children: [_jsxs("div", { className: "flex items-center justify-between px-4 py-3 border-b", children: [_jsx("h3", { className: "font-medium", children: "eCDF (cumulative citation counts)" }), _jsx("button", { className: "px-3 py-1.5 rounded-lg border hover:bg-gray-50", onClick: () => setShowEcdf(true), children: "Fullscreen" })] }), _jsx("div", { className: "p-3", children: _jsx(LineAreaChart, { data: ecdfData, xKey: "x", yKey: "y", yLabel: "count", height: 300 }) })] }), _jsxs("div", { className: "rounded-2xl border bg-white shadow-sm", children: [_jsxs("div", { className: "flex items-center justify-between px-4 py-3 border-b", children: [_jsx("h3", { className: "font-medium", children: "ePDF (citation trajectory, 30-day bins)" }), _jsx("button", { className: "px-3 py-1.5 rounded-lg border hover:bg-gray-50", onClick: () => setShowEpdf(true), children: "Fullscreen" })] }), _jsx("div", { className: "p-3", children: _jsx(LineAreaChart, { data: epdfData, xKey: "x", yKey: "y", yLabel: "count", height: 300 }) })] })] }), _jsxs("div", { className: "rounded-2xl border bg-white shadow-sm", children: [_jsx("div", { className: "flex items-center justify-between px-4 py-3 border-b", children: _jsx("h3", { className: "font-medium", children: "Citing articles" }) }), !cites || cites.status !== "OK" ? (_jsx("div", { className: "p-4 text-sm text-red-600", children: err || (cites?.error ?? "Loading...") })) : (_jsx("div", { className: "w-full overflow-x-auto", children: _jsxs("table", { className: "w-full table-fixed text-sm", children: [_jsx("thead", { className: "bg-gray-50 sticky top-0 z-10", children: _jsx("tr", { children: cites.columns.map(c => _jsx("th", { className: "px-4 py-3 text-left font-semibold text-gray-700 truncate", children: c }, c)) }) }), _jsxs("tbody", { className: "divide-y", children: [toObjs(cites.columns, cites.rows).map((r, i) => (_jsx("tr", { className: "hover:bg-gray-50", children: cites.columns.map(c => (_jsx("td", { className: `px-4 py-2 align-top ${c === "citing_doi" ? "break-all" : "break-words"} whitespace-normal`, children: c === "citing_doi" && r[c]
                                                    ? _jsx("a", { className: "text-blue-600 underline", href: `https://doi.org/${r[c]}`, target: "_blank", rel: "noreferrer", children: r[c] })
                                                    : r[c] }, c))) }, i))), cites.rows.length === 0 && (_jsx("tr", { children: _jsx("td", { className: "p-8 text-center text-gray-500", colSpan: cites.columns.length || 1, children: "No citations" }) }))] })] }) }))] }), _jsx(FullscreenModal, { open: showEcdf, onClose: () => setShowEcdf(false), title: "eCDF (cumulative citation counts)", children: _jsx(LineAreaChart, { data: ecdfData, xKey: "x", yKey: "y", yLabel: "count", height: 520 }) }), _jsx(FullscreenModal, { open: showEpdf, onClose: () => setShowEpdf(false), title: "ePDF (citation trajectory, 30-day bins)", children: _jsx(LineAreaChart, { data: epdfData, xKey: "x", yKey: "y", yLabel: "count", height: 520 }) })] }));
}

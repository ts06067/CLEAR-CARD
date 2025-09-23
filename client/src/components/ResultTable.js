import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo, useState } from "react";
export default function ResultTable({ rows }) {
    const [q, setQ] = useState("");
    const [page, setPage] = useState(0);
    const [pageSize, setPageSize] = useState(20);
    const data = rows ?? [];
    // Derive columns from first row (memoized)
    const cols = useMemo(() => (data[0] ? Object.keys(data[0]) : []), [data]);
    // Filtered rows (memoized)
    const filtered = useMemo(() => {
        if (!q.trim())
            return data;
        const needle = q.toLowerCase();
        return data.filter(r => cols.some(c => String(r[c]).toLowerCase().includes(needle)));
    }, [q, data, cols]);
    const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
    const current = useMemo(() => filtered.slice(page * pageSize, (page + 1) * pageSize), [filtered, page, pageSize]);
    if (!data.length)
        return null;
    return (_jsxs("div", { className: "space-y-2", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("input", { className: "input w-64", placeholder: "Search\u2026", value: q, onChange: e => {
                            setQ(e.target.value);
                            setPage(0);
                        } }), _jsx("select", { className: "select", value: pageSize, onChange: e => {
                            setPageSize(Number(e.target.value));
                            setPage(0);
                        }, children: [10, 20, 50, 100].map(n => (_jsxs("option", { value: n, children: [n, " / page"] }, n))) }), _jsxs("div", { className: "text-sm text-slate-500 ml-auto", children: [filtered.length, " rows"] })] }), _jsx("div", { className: "overflow-auto border rounded", children: _jsxs("table", { className: "min-w-full text-sm", children: [_jsx("thead", { className: "bg-slate-50 sticky top-0", children: _jsx("tr", { children: cols.map(c => (_jsx("th", { className: "px-3 py-2 text-left", children: c }, c))) }) }), _jsx("tbody", { children: current.map((r, i) => (_jsx("tr", { className: "odd:bg-white even:bg-slate-50", children: cols.map(c => (_jsx("td", { className: "px-3 py-1", children: String(r[c]) }, c))) }, i))) })] }) }), _jsxs("div", { className: "flex items-center gap-2 justify-end", children: [_jsx("button", { className: "btn btn-ghost", onClick: () => setPage(p => Math.max(0, p - 1)), disabled: page === 0, children: "Prev" }), _jsxs("div", { className: "text-sm", children: [page + 1, " / ", pages] }), _jsx("button", { className: "btn btn-ghost", onClick: () => setPage(p => Math.min(pages - 1, p + 1)), disabled: page === pages - 1, children: "Next" })] })] }));
}

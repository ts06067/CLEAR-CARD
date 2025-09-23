import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from "react";
import { listArticles, searchArticles } from "../api/articles";
import { useNavigate } from "react-router-dom";
import ConditionBuilder from "../features/builder/ConditionBuilder";
import useArticleCache from "../hooks/useArticleCache";
const toObjs = (cols, rows) => rows.map(r => Object.fromEntries(cols.map((c, i) => [c, r[i] ?? ""])));
export default function ArticleExplorer() {
    const { columns, fullRows, qb, yearFrom, yearTo, sort, order, page, pageSize, status, error, hydrated, setColumns, setFullRows, setQB, setYearFrom, setYearTo, setSort, setOrder, setPage, setPageSize, setStatus, setError, setHydrated, reset, } = useArticleCache();
    const [loading, setLoading] = useState(false);
    const nav = useNavigate();
    // Apply fetch
    const [applyTick, setApplyTick] = useState(0);
    const apply = () => { setPage(1); setHydrated(false); setApplyTick(x => x + 1); };
    const resetAll = () => { reset(); setApplyTick(x => x + 1); };
    useEffect(() => {
        if (hydrated && fullRows.length > 0)
            return;
        const ctrl = new AbortController();
        let cancelled = false;
        (async () => {
            setLoading(true);
            setError("");
            try {
                const isEmptyQb = !qb || !qb.rules || qb.rules.length === 0;
                const data = isEmptyQb
                    ? await listArticles({ yearFrom, yearTo, sort, order }, { signal: ctrl.signal, timeoutMs: 360000 })
                    : await searchArticles({ qb, yearFrom, yearTo, sort, order }, { signal: ctrl.signal, timeoutMs: 420000 });
                if (!cancelled) {
                    setColumns(data.columns ?? []);
                    setFullRows(data.rows ?? []);
                    setStatus(data.status);
                    setError(data.error ?? "");
                    setPage(1);
                    setHydrated(true);
                }
            }
            catch (e) {
                if (!cancelled) {
                    if (e?.code === "ECONNABORTED") {
                        setStatus("ERROR");
                        setError("Request timed out. Narrow filters or try again.");
                    }
                    else {
                        setStatus("ERROR");
                        setError(String(e));
                    }
                }
            }
            finally {
                if (!cancelled)
                    setLoading(false);
            }
        })();
        return () => { cancelled = true; ctrl.abort(); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [applyTick]);
    // totals + clamp page
    const total = fullRows.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    useEffect(() => {
        if (page > totalPages)
            setPage(totalPages);
        if (page < 1)
            setPage(1);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fullRows, pageSize, totalPages]);
    // slice
    const slice = useMemo(() => {
        const start = (page - 1) * pageSize;
        const end = start + pageSize;
        if (start >= total && total > 0)
            return fullRows.slice(Math.max(0, total - pageSize), total);
        return fullRows.slice(start, end);
    }, [fullRows, page, pageSize, total]);
    const objs = useMemo(() => toObjs(columns, slice), [columns, slice]);
    return (_jsxs("div", { className: "p-4 pt-16 space-y-4 overflow-x-hidden", children: [" ", _jsx("h1", { className: "text-3xl font-extrabold tracking-tight", children: "Article Explorer" }), _jsxs("div", { className: "rounded-2xl border bg-white shadow-sm p-4 space-y-3", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("h2", { className: "font-medium text-lg", children: "Filters" }), _jsxs("div", { className: "flex gap-2", children: [_jsx("button", { className: "px-3 py-1.5 rounded-lg border hover:bg-gray-50", onClick: resetAll, children: "Reset" }), _jsx("button", { className: "px-3 py-1.5 rounded-lg border bg-black text-white hover:bg-gray-900", onClick: apply, children: "Apply" })] })] }), _jsx("div", { className: "rounded-xl border bg-gray-50 p-3", children: _jsx(ConditionBuilder, { query: qb, onChange: setQB }) }), _jsxs("div", { className: "grid gap-3 md:grid-cols-4", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("label", { className: "text-sm w-24", children: "Year from" }), _jsx("input", { type: "number", className: "border p-2 rounded-lg w-full", value: yearFrom, onChange: e => setYearFrom(parseInt(e.target.value || "2008")) })] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("label", { className: "text-sm w-24", children: "Year to" }), _jsx("input", { type: "number", className: "border p-2 rounded-lg w-full", value: yearTo, onChange: e => setYearTo(parseInt(e.target.value || "2018")) })] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("label", { className: "text-sm w-24", children: "Sort" }), _jsxs("select", { className: "border p-2 rounded-lg w-full", value: sort, onChange: e => setSort(e.target.value), children: [_jsx("option", { value: "cited_pub_year", children: "Year" }), _jsx("option", { value: "cited_journal", children: "Journal" }), _jsx("option", { value: "citation_count", children: "2y Citations" }), _jsx("option", { value: "fitness", children: "Fitness" }), _jsx("option", { value: "cited_title", children: "Title" })] })] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("label", { className: "text-sm w-24", children: "Order" }), _jsxs("select", { className: "border p-2 rounded-lg w-full", value: order, onChange: e => setOrder(e.target.value), children: [_jsx("option", { value: "desc", children: "Desc" }), _jsx("option", { value: "asc", children: "Asc" })] })] })] }), _jsx("div", { className: "text-sm text-gray-500", children: loading ? "Loading..." : status !== "OK" ? _jsx("span", { className: "text-red-600", children: error || "Error" }) : `Total: ${total.toLocaleString()}` })] }), _jsxs("div", { className: "flex items-center justify-end gap-3", children: [_jsx("label", { className: "text-sm", children: "Page size" }), _jsxs("select", { className: "border p-2 rounded-lg", value: pageSize, onChange: e => { setPage(1); setPageSize(parseInt(e.target.value)); }, children: [_jsx("option", { children: "25" }), _jsx("option", { children: "50" }), _jsx("option", { children: "100" }), _jsx("option", { children: "150" }), _jsx("option", { children: "200" })] }), _jsx("button", { className: "px-3 py-1.5 rounded-lg border hover:bg-gray-50", disabled: page <= 1, onClick: () => setPage(Math.max(1, page - 1)), children: "Prev" }), _jsxs("span", { className: "text-sm", children: ["Page ", page, " / ", Math.max(1, totalPages)] }), _jsx("button", { className: "px-3 py-1.5 rounded-lg border hover:bg-gray-50", disabled: page >= totalPages, onClick: () => setPage(Math.min(totalPages, page + 1)), children: "Next" })] }), _jsxs("div", { className: "rounded-2xl border bg-white shadow-sm", children: [_jsx("div", { className: "flex items-center justify-between px-4 py-3 border-b", children: _jsx("h3", { className: "font-medium", children: "Articles" }) }), _jsx("div", { className: "w-full overflow-x-auto", children: _jsxs("table", { className: "w-full table-fixed text-sm", children: [_jsx("thead", { className: "bg-gray-50 sticky top-0 z-10", children: _jsx("tr", { children: columns.map(c => (_jsx("th", { className: "px-4 py-3 text-left font-semibold text-gray-700 truncate", children: c }, c))) }) }), _jsxs("tbody", { className: "divide-y", children: [objs.map((r, i) => (_jsx("tr", { className: "hover:bg-gray-50 cursor-pointer", onClick: () => r.cited_eid && nav(`/articles/${encodeURIComponent(r.cited_eid)}`), children: columns.map(c => (_jsx("td", { className: `px-4 py-2 align-top ${c === "cited_doi" ? "break-all" : "break-words"} whitespace-normal`, children: c === "cited_doi" && r[c]
                                                    ? _jsx("a", { className: "text-blue-600 underline", href: `https://doi.org/${r[c]}`, target: "_blank", rel: "noreferrer", children: r[c] })
                                                    : r[c] }, c))) }, i))), (!loading && objs.length === 0) && (_jsx("tr", { children: _jsx("td", { className: "p-8 text-center text-gray-500", colSpan: columns.length || 1, children: "No rows" }) }))] })] }) })] })] }));
}

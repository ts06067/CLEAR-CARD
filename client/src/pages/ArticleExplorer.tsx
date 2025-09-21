import { useEffect, useMemo, useState } from "react";
import { listArticles, searchArticles } from "../api/articles";
import type { TableJson } from "../api/articles";
import { useNavigate } from "react-router-dom";
import ConditionBuilder from "../features/builder/ConditionBuilder";
import useArticleCache from "../hooks/useArticleCache";

type RowObj = Record<string, string>;
const toObjs = (cols: string[], rows: string[][]): RowObj[] =>
  rows.map(r => Object.fromEntries(cols.map((c, i) => [c, r[i] ?? ""])));

export default function ArticleExplorer() {
  const {
    columns, fullRows, qb, yearFrom, yearTo, sort, order, page, pageSize,
    status, error, hydrated,
    setColumns, setFullRows, setQB, setYearFrom, setYearTo, setSort, setOrder,
    setPage, setPageSize, setStatus, setError, setHydrated, reset,
  } = useArticleCache();

  const [loading, setLoading] = useState(false);
  const nav = useNavigate();

  // Apply fetch
  const [applyTick, setApplyTick] = useState(0);
  const apply = () => { setPage(1); setHydrated(false); setApplyTick(x => x + 1); };
  const resetAll = () => { reset(); setApplyTick(x => x + 1); };

  useEffect(() => {
    if (hydrated && fullRows.length > 0) return;
    const ctrl = new AbortController();
    let cancelled = false;

    (async () => {
      setLoading(true); setError("");
      try {
        const isEmptyQb = !qb || !qb.rules || qb.rules.length === 0;
        const data: TableJson = isEmptyQb
          ? await listArticles({ yearFrom, yearTo, sort, order }, { signal: ctrl.signal, timeoutMs: 360_000 })
          : await searchArticles({ qb, yearFrom, yearTo, sort, order }, { signal: ctrl.signal, timeoutMs: 420_000 });

        if (!cancelled) {
          setColumns(data.columns ?? []);
          setFullRows(data.rows ?? []);
          setStatus(data.status);
          setError(data.error ?? "");
          setPage(1);
          setHydrated(true);
        }
      } catch (e: any) {
        if (!cancelled) {
          if (e?.code === "ECONNABORTED") {
            setStatus("ERROR");
            setError("Request timed out. Narrow filters or try again.");
          } else { setStatus("ERROR"); setError(String(e)); }
        }
      } finally { if (!cancelled) setLoading(false); }
    })();

    return () => { cancelled = true; ctrl.abort(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applyTick]);

  // totals + clamp page
  const total = fullRows.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
    if (page < 1) setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fullRows, pageSize, totalPages]);

  // slice
  const slice = useMemo(() => {
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    if (start >= total && total > 0) return fullRows.slice(Math.max(0, total - pageSize), total);
    return fullRows.slice(start, end);
  }, [fullRows, page, pageSize, total]);

  const objs = useMemo(() => toObjs(columns, slice), [columns, slice]);

  return (
    <div className="p-4 pt-16 space-y-4 overflow-x-hidden"> {/* stop page-level overflow */}
      <h1 className="text-3xl font-extrabold tracking-tight">Article Explorer</h1>

      {/* Filter card */}
      <div className="rounded-2xl border bg-white shadow-sm p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-medium text-lg">Filters</h2>
          <div className="flex gap-2">
            <button className="px-3 py-1.5 rounded-lg border hover:bg-gray-50" onClick={resetAll}>Reset</button>
            <button className="px-3 py-1.5 rounded-lg border bg-black text-white hover:bg-gray-900" onClick={apply}>Apply</button>
          </div>
        </div>

        <div className="rounded-xl border bg-gray-50 p-3">
          <ConditionBuilder query={qb} onChange={setQB} />
        </div>

        <div className="grid gap-3 md:grid-cols-4">
          <div className="flex items-center gap-2">
            <label className="text-sm w-24">Year from</label>
            <input type="number" className="border p-2 rounded-lg w-full" value={yearFrom}
                   onChange={e => setYearFrom(parseInt(e.target.value || "2008"))}/>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm w-24">Year to</label>
            <input type="number" className="border p-2 rounded-lg w-full" value={yearTo}
                   onChange={e => setYearTo(parseInt(e.target.value || "2018"))}/>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm w-24">Sort</label>
            <select className="border p-2 rounded-lg w-full" value={sort} onChange={e => setSort(e.target.value as any)}>
              <option value="cited_pub_year">Year</option>
              <option value="cited_journal">Journal</option>
              <option value="citation_count">2y Citations</option>
              <option value="fitness">Fitness</option>
              <option value="cited_title">Title</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm w-24">Order</label>
            <select className="border p-2 rounded-lg w-full" value={order} onChange={e => setOrder(e.target.value as any)}>
              <option value="desc">Desc</option>
              <option value="asc">Asc</option>
            </select>
          </div>
        </div>

        <div className="text-sm text-gray-500">
          {loading ? "Loading..." : status !== "OK" ? <span className="text-red-600">{error || "Error"}</span> : `Total: ${total.toLocaleString()}`}
        </div>
      </div>

      {/* Pager */}
      <div className="flex items-center justify-end gap-3">
        <label className="text-sm">Page size</label>
        <select
          className="border p-2 rounded-lg"
          value={pageSize}
          onChange={e => { setPage(1); setPageSize(parseInt(e.target.value)); }}
        >
          <option>25</option><option>50</option><option>100</option><option>150</option><option>200</option>
        </select>
        <button className="px-3 py-1.5 rounded-lg border hover:bg-gray-50"
                disabled={page <= 1}
                onClick={() => setPage(Math.max(1, page - 1))}>Prev</button>
        <span className="text-sm">Page {page} / {Math.max(1, totalPages)}</span>
        <button className="px-3 py-1.5 rounded-lg border hover:bg-gray-50"
                disabled={page >= totalPages}
                onClick={() => setPage(Math.min(totalPages, page + 1))}>Next</button>
      </div>

      {/* Table card (no fullscreen, scrollable) */}
      <div className="rounded-2xl border bg-white shadow-sm">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h3 className="font-medium">Articles</h3>
        </div>
        <div className="w-full overflow-x-auto">
          <table className="w-full table-fixed text-sm">
            <thead className="bg-gray-50 sticky top-0 z-10">
              <tr>
                {columns.map(c => (
                  <th key={c} className="px-4 py-3 text-left font-semibold text-gray-700 truncate">{c}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {objs.map((r, i) => (
                <tr key={i}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => r.cited_eid && nav(`/articles/${encodeURIComponent(r.cited_eid)}`)}>
                  {columns.map(c => (
                    <td key={c}
                        className={`px-4 py-2 align-top ${c === "cited_doi" ? "break-all" : "break-words"} whitespace-normal`}>
                      {c === "cited_doi" && r[c]
                        ? <a className="text-blue-600 underline" href={`https://doi.org/${r[c]}`} target="_blank" rel="noreferrer">{r[c]}</a>
                        : r[c]}
                    </td>
                  ))}
                </tr>
              ))}
              {(!loading && objs.length === 0) && (
                <tr><td className="p-8 text-center text-gray-500" colSpan={columns.length || 1}>No rows</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

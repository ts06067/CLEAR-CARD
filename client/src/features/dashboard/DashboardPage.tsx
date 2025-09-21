import { memo, useDeferredValue, useEffect, useMemo, useState, useCallback } from "react";
import { useAppSelector } from "../../app/hooks";
import { getJob, getResultJson, type JobSummary } from "../../api/jobs";
import InteractiveChart from "../../components/InteractiveChart";
import LoadingOverlay from "../../components/LoadingOverlay";
import { selectPinnedJobs } from "../job/selectors";

/* ---------- helpers copied from JobDetail ---------- */
function asNumber(v: any): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}
function pickXKey(rows: any[], cfg: any | null): string {
  const first = rows?.[0];
  if (!first) return "x";
  if (cfg?.x && Object.prototype.hasOwnProperty.call(first, cfg.x)) return cfg.x;
  const prefs = ["cited_pub_year", "cited_pub_date", "cited_pub_month", "cited_pub_day"];
  for (const p of prefs) if (Object.prototype.hasOwnProperty.call(first, p)) return p;
  const keys = Object.keys(first);
  const nonNum = keys.find((k) => asNumber(first[k]) === undefined);
  return nonNum ?? keys[0] ?? "x";
}
function pickMeasureKey(rows: any[], cfg: any | null): string | undefined {
  const first = rows?.[0];
  if (!first) return undefined;
  if (cfg) {
    const key = cfg.yAgg === "COUNT" || cfg.yField === "n_article" ? "n_articles" : "y_value";
    if (Object.prototype.hasOwnProperty.call(first, key)) return key;
  }
  if (Object.prototype.hasOwnProperty.call(first, "n_articles")) return "n_articles";
  if (Object.prototype.hasOwnProperty.call(first, "y_value")) return "y_value";
  return Object.keys(first).find((k) => asNumber(first[k]) !== undefined);
}
function makeGroupLabel(row: any, fields: string[]): string {
  if (!fields.length) return "__single__";
  return fields.map((f) => String(row?.[f] ?? "∅")).join(" · ");
}
function inferGroupFields(rows: any[], cfg: any | null): string[] {
  if (cfg?.groupBy && Array.isArray(cfg.groupBy) && cfg.groupBy.length > 0) {
    return (cfg.groupBy as string[]).filter(Boolean);
  }
  if (!rows?.length) return [];
  const first = rows[0];
  const keys = Object.keys(first);
  if (keys.includes("cited_journal")) return ["cited_journal"];
  const LIMIT = 20;
  for (const k of keys) {
    const sample = new Set<string>();
    let seen = 0;
    for (const r of rows) {
      const v = r?.[k];
      if (typeof v === "string") sample.add(v);
      seen++; if (seen > 1000) break;
      if (sample.size > LIMIT) break;
    }
    if (sample.size > 1 && sample.size <= LIMIT) return [k];
  }
  return [];
}

/* ---------- Modal table ---------- */
function TablePopup({
  open, onClose, title, columns, rows,
}: { open: boolean; onClose: () => void; title: string; columns: string[]; rows: any[]; }) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);
  const slice = useMemo(() => rows.slice((page-1)*pageSize, (page-1)*pageSize + pageSize), [rows, page, pageSize]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[200] bg-black/40 backdrop-blur-sm flex items-center justify-center" onClick={onClose}>
      <div className="bg-white w-[min(1200px,95vw)] max-h-[90vh] rounded-2xl shadow-2xl overflow-hidden animate-[zoomIn_160ms_ease-out]" onClick={(e)=>e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b bg-white/80 backdrop-blur">
          <div className="font-medium">{title}</div>
          <button className="px-3 py-1.5 rounded-lg border hover:bg-gray-50" onClick={onClose}>Close</button>
        </div>
        <div className="p-3 space-y-3">
          <div className="flex items-center justify-end gap-3">
            <span className="text-sm text-slate-600">Rows: {total.toLocaleString()}</span>
            <label className="text-sm">Page size</label>
            <select className="border rounded px-2 py-1 text-sm" value={pageSize} onChange={(e)=>{ setPage(1); setPageSize(parseInt(e.target.value)); }}>
              <option>25</option><option>50</option><option>100</option><option>200</option>
            </select>
            <button className="px-3 py-1.5 rounded-lg border hover:bg-gray-50" onClick={()=>setPage(Math.max(1,page-1))} disabled={page<=1}>Prev</button>
            <span className="text-sm">Page {page} / {totalPages}</span>
            <button className="px-3 py-1.5 rounded-lg border hover:bg-gray-50" onClick={()=>setPage(Math.min(totalPages,page+1))} disabled={page>=totalPages}>Next</button>
          </div>
          <div className="w-full overflow-x-auto">
            <table className="w-full table-fixed text-sm">
              <thead className="bg-gray-50">
                <tr>{columns.map((c)=><th key={c} className="px-4 py-2 text-left font-semibold text-gray-700 truncate">{c}</th>)}</tr>
              </thead>
              <tbody className="divide-y">
                {slice.map((r,i)=>(
                  <tr key={i} className="hover:bg-gray-50">
                    {columns.map((c)=>(
                      <td key={c} className={`px-4 py-2 align-top ${c.toLowerCase().includes("doi")?"break-all":"break-words"} whitespace-normal`}>
                        {String(r[c] ?? "")}
                      </td>
                    ))}
                  </tr>
                ))}
                {slice.length===0 && <tr><td className="p-8 text-center text-gray-500" colSpan={columns.length||1}>No rows</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <style>{`@keyframes zoomIn{from{transform:scale(.98);opacity:.5}to{transform:scale(1);opacity:1}}`}</style>
    </div>
  );
}

/* ---------- Single pinned card ---------- */
const PinnedJobCard = memo(function PinnedJobCard({
  job, onBusy,
}: { job: JobSummary; onBusy: (delta: number) => void }) {
  const [rows, setRows] = useState<any[]>([]);
  const [cfg, setCfg]   = useState<any | null>(null);
  const [title, setTitle] = useState<string>(job.title || `Job ${job.id}`);
  const [openTable, setOpenTable] = useState(false);

  useEffect(() => {
    let alive = true;
    onBusy(+1);
    (async () => {
      try {
        const d = await getJob(job.id);
        if (!alive) return;
        setTitle(d?.title || job.title || `Job ${job.id}`);
        setCfg(d?.config?.cfg ?? null);
      } catch {}
      try {
        const data = await getResultJson(job.id);
        if (!alive) return;
        setRows(Array.isArray(data) ? data : []);
      } catch { if (alive) setRows([]); }
      onBusy(-1);                   // balance on finish
    })();
    return () => { alive = false; onBusy(-1); }; // balance on unmount/StrictMode second pass
    // effect depends only on job.id to avoid loops
  }, [job.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const xKey = useMemo(() => pickXKey(rows, cfg), [rows, cfg]);
  const measureKey = useMemo(() => pickMeasureKey(rows, cfg), [rows, cfg]);

  const { chartData, seriesKeys, columns } = useMemo(() => {
    if (!rows?.length || !measureKey) return { chartData: [] as any[], seriesKeys: [] as string[], columns: [] as string[] };

    const groupFields = inferGroupFields(rows, cfg);
    const singleSeries = groupFields.length === 0;

    const xMap = new Map<string | number, any>();
    const totals = new Map<string, number>();
    let hadOther = false;

    for (const r of rows) {
      const xv = r[xKey];
      const label = singleSeries ? "__single__" : makeGroupLabel(r, groupFields);
      const y = asNumber(r[measureKey]);
      if (y === undefined) continue;

      if (!xMap.has(xv)) xMap.set(xv, { [xKey]: xv });

      const obj = xMap.get(xv)!;
      obj[label] = (obj[label] ?? 0) + y;
      totals.set(label, (totals.get(label) ?? 0) + y);
    }

    const limit = Math.max(1, Math.min(12, singleSeries ? 1 : 12));
    let labels = Array.from(totals.entries()).sort((a,b)=>b[1]-a[1]).map(([k])=>k);
    const TOP = labels.slice(0, limit);
    const OTHER = "Other";

    const data: any[] = [];
    for (const obj of xMap.values()) {
      let other = 0;
      for (const key of Object.keys(obj)) {
        if (key === xKey) continue;
        if (!TOP.includes(key)) { other += obj[key] as number; delete obj[key]; }
      }
      if (other > 0) { obj[OTHER] = other; hadOther = true; }
      data.push(obj);
    }

    const finalSeries = singleSeries ? ["__single__"] : hadOther ? [...TOP, OTHER] : TOP;

    if (singleSeries) {
      for (const obj of data) {
        if (obj.__single__ != null) { obj[measureKey] = obj.__single__; delete obj.__single__; }
      }
    }

    const seriesKeys = singleSeries ? [measureKey] : finalSeries;
    const columns = rows.length ? Object.keys(rows[0]) : [];
    return { chartData: data, seriesKeys, columns };
  }, [rows, cfg, xKey, measureKey]);

  return (
    <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
      <div className="flex items-start justify-between px-4 py-3 border-b bg-gradient-to-r from-slate-50 to-white">
        <div className="min-w-0">
          <div className="font-semibold truncate">{title}</div>
          <div className="text-xs text-slate-500 truncate">#{job.id}</div>
        </div>
        <button className="px-2 py-1 rounded-lg border hover:bg-gray-50" onClick={() => setOpenTable(true)}>…</button>
      </div>

      <div className="p-3">
        {chartData.length > 0 && seriesKeys.length > 0 ? (
          <InteractiveChart
            defaultKind="bar"
            data={chartData}
            xKey={xKey}
            yKeys={seriesKeys.map((k) => ({ key: k, name: k }))}
            xLabel={xKey}
          />
        ) : (
          <div className="text-sm text-slate-500">No numeric series to plot.</div>
        )}
      </div>

      <TablePopup open={openTable} onClose={() => setOpenTable(false)} title={title} columns={columns} rows={rows} />
    </div>
  );
});

/* ---------- Dashboard ---------- */
export default function DashboardPage() {
  const pinned = useAppSelector(selectPinnedJobs);
  const deferredPinned = useDeferredValue(pinned);

  const [busy, setBusy] = useState(0);
  const onBusy = useCallback((delta: number) => {
    setBusy((b) => Math.max(0, b + delta));
  }, []);

  return (
    <div className="p-4 pt-16 space-y-4 overflow-x-hidden">
      <LoadingOverlay open={busy > 0} text="Loading pinned jobs…" />
      <h1 className="text-3xl font-extrabold tracking-tight">Dashboard</h1>

      <section className="space-y-4">
        <h2 className="text-xl font-bold">Pinned</h2>
        {deferredPinned.length === 0 && (
          <div className="text-slate-500">No pinned jobs yet. Pin jobs from the Job Lists page.</div>
        )}
        <div className="grid lg:grid-cols-2 gap-6">
          {deferredPinned.slice(0, 6).map((j) => (
            <PinnedJobCard key={j.id} job={j} onBusy={onBusy} />
          ))}
        </div>
      </section>
    </div>
  );
}

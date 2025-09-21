import { useEffect, useMemo, useState } from "react";
import { getArticleCitations, getArticleDetail } from "../api/articles";
import type { TableJson } from "../api/articles";
import { useNavigate, useParams } from "react-router-dom";
import FullscreenModal from "../components/FullscreenModal";

/* ---------- helpers ---------- */

type Obj = Record<string, string>;
const toObjs = (cols: string[], rows: string[][]): Obj[] =>
  rows.map(r => Object.fromEntries(cols.map((c, i) => [c, r[i] ?? ""])));

function uniqueSortedCounts(values: number[]) {
  const map = new Map<number, number>();
  for (const v of values) map.set(v, (map.get(v) || 0) + 1);
  const xs = Array.from(map.keys()).sort((a,b)=>a-b);
  const ys = xs.map(x => map.get(x)!);
  return { xs, ys };
}

function ecdfCounts(samples: number[]) {
  const { xs, ys } = uniqueSortedCounts(samples);
  const out: {x:number,y:number}[] = [];
  let cum = 0; for (let i=0;i<xs.length;i++) { cum += ys[i]; out.push({ x: xs[i], y: cum }); }
  return out;
}

function epdfHistogramCounts(samples: number[], binWidth: number) {
  if (!samples.length) return [];
  const max = Math.max(...samples);
  const out: {x:number,y:number}[] = [];
  for (let start=0; start<=max; start+=binWidth) {
    const end = start + binWidth;
    const cnt = samples.filter(v => v >= start && v < end).length;
    out.push({ x: start + binWidth/2, y: cnt });
  }
  return out;
}

/** Responsive line/area chart — strictly contained; no horizontal overflow */
function LineAreaChart({
  data, xKey, yKey, yLabel, fill = true, height = 300,
}: { data: any[]; xKey: string; yKey: string; yLabel?: string; fill?: boolean; height?: number }) {
  const W = 1000;                                  // logical width for scaling
  const H = height;
  const pad = 40, ws = W - pad*2, hs = H - pad*2;
  const xs = data.map(d => +d[xKey] || 0);
  const ys = data.map(d => +d[yKey] || 0);
  const maxX = xs.length ? Math.max(...xs) : 1;
  const maxY = ys.length ? Math.max(...ys) : 1;
  const sx = (v:number) => pad + (maxX ? (v/maxX)*ws : 0);
  const sy = (v:number) => pad + hs - (maxY ? (v/maxY)*hs : 0);
  const points = data.map(d => `${sx(+d[xKey])},${sy(+d[yKey])}`).join(" ");
  const area = `M ${sx(0)},${sy(0)} L ${points} L ${sx(maxX)},${sy(0)} Z`;
  const gridX = 5, gridY = 4;

  return (
    <div className="w-full overflow-x-hidden"> {/* container clips any overflow */}
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full block" style={{ height }}>
        <rect x={0} y={0} width={W} height={H} rx={16} fill="#fff" />
        {Array.from({length:gridY+1}).map((_,i)=>{ const y = pad+(i/gridY)*hs; return <line key={`gy${i}`} x1={pad} y1={y} x2={pad+ws} y2={y} stroke="#e5e7eb"/>; })}
        {Array.from({length:gridX+1}).map((_,i)=>{ const x = pad+(i/gridX)*ws; return <line key={`gx${i}`} x1={x} y1={pad} x2={x} y2={pad+hs} stroke="#f1f5f9"/>; })}
        <line x1={pad} y1={pad+hs} x2={pad+ws} y2={pad+hs} stroke="#9ca3af"/>
        <line x1={pad} y1={pad}   x2={pad}    y2={pad+hs} stroke="#9ca3af"/>
        {Array.from({length:gridX+1}).map((_,i)=>{ const x=pad+(i/gridX)*ws; const v=Math.round((i/gridX)*maxX);
          return <g key={`tx${i}`}><line x1={x} y1={pad+hs} x2={x} y2={pad+hs+4} stroke="#9ca3af"/><text x={x} y={pad+hs+18} fontSize="11" textAnchor="middle" fill="#6b7280">{v}</text></g> })}
        {Array.from({length:gridY+1}).map((_,i)=>{ const y=pad+hs-(i/gridY)*hs; const v=Math.round((i/gridY)*maxY);
          return <g key={`ty${i}`}><line x1={pad-4} y1={y} x2={pad} y2={y} stroke="#9ca3af"/><text x={pad-8} y={y+3} fontSize="11" textAnchor="end" fill="#6b7280">{v}</text></g> })}
        {fill && <path d={area} fill="#c7d2fe" opacity={0.6}/>}
        <polyline fill="none" stroke="#4f46e5" strokeWidth="2.5" points={points}/>
        {yLabel && <text x={12} y={pad+hs/2} fontSize="12" textAnchor="middle" transform={`rotate(-90 12 ${pad+hs/2})`} fill="#374151">{yLabel}</text>}
      </svg>
    </div>
  );
}

export default function ArticleDetail() {
  const { eid } = useParams<{eid: string}>();
  const nav = useNavigate();

  const [detail, setDetail] = useState<any>(null);
  const [cites, setCites] = useState<TableJson | null>(null);
  const [err, setErr] = useState<string>("");

  const [showEcdf, setShowEcdf] = useState(false);
  const [showEpdf, setShowEpdf] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const d = await getArticleDetail(eid!, { timeoutMs: 120_000 });
        if (!cancelled) setDetail(d);
        const c = await getArticleCitations(eid!, { timeoutMs: 240_000 });
        if (!cancelled) setCites(c);
      } catch (e: any) { if (!cancelled) setErr(String(e)); }
    })();
    return () => { cancelled = true; };
  }, [eid]);

  const citeObjs = useMemo(() => cites ? toObjs(cites.columns, cites.rows) : [], [cites]);
  const times = useMemo(() =>
    citeObjs.map(r => Number(r.citation_time_days)).filter(v => !isNaN(v) && isFinite(v)), [citeObjs]);

  const ecdfData = useMemo(() => ecdfCounts(times).map(d => ({ x: d.x, y: d.y })), [times]);
  const epdfData = useMemo(() => epdfHistogramCounts(times, 30).map(d => ({ x: d.x, y: d.y })), [times]);

  return (
    <div className="p-4 pt-16 space-y-4 overflow-x-hidden">
      <div className="flex items-center gap-3">
        <button className="px-3 py-1.5 rounded-lg border hover:bg-slate-100" onClick={() => nav(-1)}>← Back</button>
        <h1 className="text-3xl font-extrabold tracking-tight">Article Detail</h1>
      </div>

      <div className="rounded-2xl border bg-white shadow-sm p-4 space-y-2">
        {!detail ? (
          <div>Loading...</div>
        ) : (
          <>
            <h2 className="text-lg font-semibold leading-snug">{detail.cited_title}</h2>
            <div className="flex flex-wrap items-center gap-3 text-sm text-gray-700">
              {detail.cited_doi && (
                <a className="inline-flex items-center gap-1 text-indigo-600 underline"
                   href={`https://doi.org/${detail.cited_doi}`} target="_blank" rel="noreferrer">DOI</a>
              )}
              <span className="px-2 py-0.5 rounded-full bg-gray-100">{detail.cited_journal}</span>
              <span className="px-2 py-0.5 rounded-full bg-gray-100">{detail.cited_pub_date}</span>
              <span className="px-2 py-0.5 rounded-full bg-violet-100 text-violet-700">Category: {detail.cited_category ?? "-"}</span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">Fitness: {detail.fitness ?? "-"}</span>
              <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">2y citations: {detail.citation_count_2y ?? "-"}</span>
            </div>
          </>
        )}
      </div>

      {/* Charts */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="rounded-2xl border bg-white shadow-sm">
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <h3 className="font-medium">eCDF (cumulative citation counts)</h3>
            <button className="px-3 py-1.5 rounded-lg border hover:bg-gray-50"
                    onClick={() => setShowEcdf(true)}>Fullscreen</button>
          </div>
          <div className="p-3">
            <LineAreaChart data={ecdfData} xKey="x" yKey="y" yLabel="count" height={300}/>
          </div>
        </div>
        <div className="rounded-2xl border bg-white shadow-sm">
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <h3 className="font-medium">ePDF (citation trajectory, 30-day bins)</h3>
            <button className="px-3 py-1.5 rounded-lg border hover:bg-gray-50"
                    onClick={() => setShowEpdf(true)}>Fullscreen</button>
          </div>
          <div className="p-3">
            <LineAreaChart data={epdfData} xKey="x" yKey="y" yLabel="count" height={300}/>
          </div>
        </div>
      </div>

      {/* Citing articles table (scrollable) */}
      <div className="rounded-2xl border bg-white shadow-sm">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h3 className="font-medium">Citing articles</h3>
        </div>
        {!cites || cites.status !== "OK" ? (
          <div className="p-4 text-sm text-red-600">{err || (cites?.error ?? "Loading...")}</div>
        ) : (
          <div className="w-full overflow-x-auto">
            <table className="w-full table-fixed text-sm">
              <thead className="bg-gray-50 sticky top-0 z-10">
                <tr>{cites.columns.map(c => <th key={c} className="px-4 py-3 text-left font-semibold text-gray-700 truncate">{c}</th>)}</tr>
              </thead>
              <tbody className="divide-y">
                {toObjs(cites.columns, cites.rows).map((r, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    {cites.columns.map(c => (
                      <td key={c}
                          className={`px-4 py-2 align-top ${c === "citing_doi" ? "break-all" : "break-words"} whitespace-normal`}>
                        {c === "citing_doi" && r[c]
                          ? <a className="text-blue-600 underline" href={`https://doi.org/${r[c]}`} target="_blank" rel="noreferrer">{r[c]}</a>
                          : r[c]}
                      </td>
                    ))}
                  </tr>
                ))}
                {cites.rows.length === 0 && (
                  <tr><td className="p-8 text-center text-gray-500" colSpan={cites.columns.length || 1}>No citations</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Plot fullscreens only */}
      <FullscreenModal open={showEcdf} onClose={() => setShowEcdf(false)} title="eCDF (cumulative citation counts)">
        <LineAreaChart data={ecdfData} xKey="x" yKey="y" yLabel="count" height={520}/>
      </FullscreenModal>

      <FullscreenModal open={showEpdf} onClose={() => setShowEpdf(false)} title="ePDF (citation trajectory, 30-day bins)">
        <LineAreaChart data={epdfData} xKey="x" yKey="y" yLabel="count" height={520}/>
      </FullscreenModal>
    </div>
  );
}

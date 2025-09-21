// client/src/features/job/JobDetailPage.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getJob, getJobStatus, getResultJson } from "../../api/jobs";
import ResultTable from "../../components/ResultTable";
import InteractiveChart from "../../components/InteractiveChart";
import LoadingOverlay from "../../components/LoadingOverlay";
import type { ChartConfig } from "../config/chartConfig";

/** number coercion for "123" → 123 */
function asNumber(v: any): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

/** choose a reasonable xKey if cfg missing */
function pickXKey(rows: any[], cfg: ChartConfig | null): string {
  const first = rows?.[0];
  if (!first) return "x";
  if (cfg?.x && Object.prototype.hasOwnProperty.call(first, cfg.x)) return cfg.x;
  const prefs = ["cited_pub_year", "cited_pub_date", "cited_pub_month", "cited_pub_day"];
  for (const p of prefs) if (Object.prototype.hasOwnProperty.call(first, p)) return p;
  const keys = Object.keys(first);
  const nonNum = keys.find((k) => asNumber(first[k]) === undefined);
  return nonNum ?? keys[0] ?? "x";
}

/** pick measure column */
function pickMeasureKey(rows: any[], cfg: ChartConfig | null): string | undefined {
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

/** build a group label like "JACC · Original" for multi-field grouping */
function makeGroupLabel(row: any, fields: string[]): string {
  if (!fields.length) return "__single__";
  return fields.map((f) => String(row?.[f] ?? "∅")).join(" · ");
}

export default function JobDetailPage() {
  const { id = "" } = useParams();
  const nav = useNavigate();
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string>();
  const [detail, setDetail] = useState<any>();
  const [rows, setRows] = useState<any[]>([]);
  const [status, setStatus] = useState<string>("PENDING");
  const loadedRef = useRef(false);

  useEffect(() => {
    let alive = true;
    loadedRef.current = false;

    (async () => {
      try {
        const d = await getJob(id);
        if (!alive) return;
        setDetail(d);

        const s = await getJobStatus(id);
        if (!alive) return;
        setStatus(s.state);

        if (s.state === "FAILED") {
          setErr(s.error || "Job failed");
        } else if (s.state === "SUCCEEDED") {
          const data = await getResultJson(id);
          if (!alive) return;
          if (data && Array.isArray(data)) {
            loadedRef.current = true;
            setRows(data);
          }
        }
      } catch (e: any) {
        setErr(e?.message ?? "Failed to load");
      } finally {
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
      } catch (_e) {
        console.error("Error polling job status", _e);
      }
    }, 2500);

    return () => {
      alive = false;
      clearInterval(poll);
    };
  }, [id]);

  const cfg = (detail?.config?.cfg ?? null) as ChartConfig | null;

  const xKey = useMemo<string>(() => pickXKey(rows, cfg), [rows, cfg]);
  const measureKey = useMemo<string | undefined>(() => pickMeasureKey(rows, cfg), [rows, cfg]);

  const { chartData, seriesKeys } = useMemo(() => {
    if (!rows?.length || !measureKey) return { chartData: [] as any[], seriesKeys: [] as string[] };

    const groupFields = (cfg?.groupBy ?? []).filter(Boolean) as string[];
    const singleSeries = groupFields.length === 0;

    const xMap = new Map<string | number, any>();
    const totals = new Map<string, number>();
    let hadOther = false;

    for (const r of rows) {
      const xVal = r[xKey];
      const label = singleSeries ? "__single__" : makeGroupLabel(r, groupFields);
      const y = asNumber(r[measureKey]);
      if (y === undefined) continue;

      if (!xMap.has(xVal)) xMap.set(xVal, { [xKey]: xVal });

      const obj = xMap.get(xVal)!;
      obj[label] = (obj[label] ?? 0) + y;
      totals.set(label, (totals.get(label) ?? 0) + y);
    }

    const limit = Math.max(1, Math.min(12, singleSeries ? 1 : 12));
    let labels = Array.from(totals.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([k]) => k);

    const TOP = labels.slice(0, limit);
    const OTHER = "Other";

    const data: any[] = [];
    for (const obj of xMap.values()) {
      let otherSum = 0;
      for (const key of Object.keys(obj)) {
        if (key === xKey) continue;
        if (!TOP.includes(key)) {
          otherSum += obj[key] as number;
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

  return (
    <div className="p-4 pt-16 space-y-4 overflow-x-hidden">
      {/* Back button & title */}
      <div className="flex items-baseline gap-3">
        <button
          className="px-3 py-1.5 rounded-lg border hover:bg-slate-100"
          onClick={() => nav(-1)}
        >
          ← Back
        </button>
        <h1 className="text-3xl font-extrabold tracking-tight">Job Detail</h1>
        <span className="text-slate-500">#{id}</span>
      </div>

      {/* Page-level loading overlay */}
      <LoadingOverlay open={showOverlay} text="Loading result…" />

      {err && <div className="text-red-600">{err}</div>}

      {detail && (
        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-12 lg:col-span-5">
            <div className="card">
              <div className="card-h">Configuration</div>
              <div className="card-b space-y-2 text-sm">
                <div><span className="font-semibold">Title:</span> {detail.title || "-"}</div>
                <div><span className="font-semibold">Status:</span> {status}</div>
                <div className="font-semibold">SQL:</div>
                <pre className="bg-slate-900 text-slate-100 text-xs rounded p-3 overflow-auto max-h-72">
                  {detail.sql}
                </pre>
                {detail.config && (
                  <>
                    <div className="font-semibold">Query Builder</div>
                    <pre className="bg-slate-50 p-2 rounded text-xs overflow-auto max-h-40">
                      {JSON.stringify(detail.config.qb, null, 2)}
                    </pre>
                    <div className="font-semibold">Chart Config</div>
                    <pre className="bg-slate-50 p-2 rounded text-xs overflow-auto max-h-40">
                      {JSON.stringify(detail.config.cfg, null, 2)}
                    </pre>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="col-span-12 lg:col-span-7 space-y-4">
            <div className="card">
              <div className="card-h">Result (Table)</div>
              <div className="card-b">
                <ResultTable rows={rows} />
              </div>
            </div>

            <div className="card">
              <div className="card-h">Result (Interactive Chart)</div>
              <div className="card-b">
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
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

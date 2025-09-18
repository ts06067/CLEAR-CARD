import { memo, useDeferredValue, useEffect, useMemo, useState } from "react";
import { getDefaultMetrics } from "../../api/metrics";
import InteractiveChart from "../../components/InteractiveChart";
import { useAppSelector } from "../../app/hooks";
import { getResultJson } from "../../api/jobs";
import ResultTable from "../../components/ResultTable";
import { selectPinnedJobs, selectPinnedIds } from "../job/selectors";
import type { JobSummary } from "../../api/jobs";

// ---- Helpers to infer chart keys safely ----
function inferXKey(rows: any[]): string {
  const first = rows?.[0];
  return first ? (Object.keys(first)[0] ?? "x") : "x";
}
function inferYKeys(rows: any[]): { key: string; name?: string }[] {
  const first = rows?.[0];
  if (!first) return [{ key: "value" }];
  const numeric = Object.keys(first).filter((k) => typeof first[k] === "number");
  const picked = numeric.length ? numeric : Object.keys(first).slice(1, 2);
  return (picked.length ? picked : ["value"]).map((k) => ({ key: k }));
}

/** Memoized pinned card to avoid re-render churn. */
const PinnedCard = memo(function PinnedCard({ job, rows }: { job: JobSummary; rows: any[] }) {
  const tableRows = useMemo(() => rows.slice(0, 200), [rows]);
  const chartData = useMemo(() => rows.slice(0, 50), [rows]);
  const xKey = useMemo(() => inferXKey(chartData), [chartData]);
  const yKeys = useMemo(() => inferYKeys(chartData), [chartData]);

  return (
    <div className="card">
      <div className="card-h">{job.title || `Job ${job.id}`}</div>
      <div className="card-b space-y-3">
        <ResultTable rows={tableRows} />
        <div className="opacity-80">
          <InteractiveChart kind="bar" data={chartData} xKey={xKey} yKeys={yKeys} />
        </div>
        <div className="text-xs text-slate-400">For interactive charts, open the job detail.</div>
      </div>
    </div>
  );
});

export default function DashboardPage() {
  const [m, setM] = useState<any>();
  const [err, setErr] = useState<string>();
  const [loading, setLoading] = useState(true);

  // Memoized selectors (stable references)
  const pinned = useAppSelector(selectPinnedJobs);
  const pinnedIds = useAppSelector(selectPinnedIds);

  // Defer heavy pinned rendering a bit for responsiveness
  const deferredPinned = useDeferredValue(pinned);

  useEffect(() => {
    (async () => {
      try {
        const data = await getDefaultMetrics();
        setM(data);
      } catch (e: any) {
        setErr(e?.message ?? "Failed to load metrics");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Fetch pinned previews ONLY when the set of pinned IDs changes.
  const [pinData, setPinData] = useState<Record<string, any[]>>({});
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const ids = pinnedIds.slice(0, 6); // limit dashboard previews

      if (!ids.length) {
        // Clear once if needed
        setPinData((prev) => (Object.keys(prev).length ? {} : prev));
        return;
      }

      // Use object results (not tuples) to avoid readonly tuple types
      const results: Array<{ id: string; rows: any[] }> = await Promise.all(
        ids.map(async (id) => {
          try {
            const rows = (await getResultJson(id)) ?? [];
            return { id, rows: Array.isArray(rows) ? rows : [] };
          } catch {
            return { id, rows: [] };
          }
        })
      );

      if (cancelled) return;

      setPinData((prev) => {
        const next: Record<string, any[]> = {};
        let changed = false;

        for (const { id, rows } of results) {
          next[id] = rows;
          if (!prev[id] || prev[id].length !== rows.length) changed = true;
        }
        for (const k of Object.keys(prev)) {
          if (!ids.includes(k)) changed = true;
        }
        return changed ? next : prev;
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [pinnedIds]);

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-extrabold tracking-tight">Dashboard</h1>

      {/* (1) Default result */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold">Default</h2>
        {loading && <div>Loading…</div>}
        {err && <div className="text-red-600">{err}</div>}
        {m && (
          <div className="grid lg:grid-cols-2 gap-6">
            <div className="card">
              <div className="card-h">Total publications by journal</div>
              <div className="card-b">
                <InteractiveChart
                  kind="bar"
                  data={m.publicationsByJournal}
                  xKey="journal"
                  yKeys={[{ key: "count", name: "publications" }]}
                />
              </div>
            </div>
            <div className="card">
              <div className="card-h">Total citations by journal</div>
              <div className="card-b">
                <InteractiveChart kind="bar" data={m.citationsByJournal} xKey="journal" yKeys={[{ key: "count" }]} />
              </div>
            </div>
            <div className="card">
              <div className="card-h">Publications in 2024 by journal</div>
              <div className="card-b">
                <InteractiveChart
                  kind="bar"
                  data={m.publications2024ByJournal}
                  xKey="journal"
                  yKeys={[{ key: "count" }]}
                />
              </div>
            </div>
            <div className="card">
              <div className="card-h">Citations in 2024 by journal</div>
              <div className="card-b">
                <InteractiveChart
                  kind="bar"
                  data={m.citations2024ByJournal}
                  xKey="journal"
                  yKeys={[{ key: "count" }]}
                />
              </div>
            </div>
            <div className="card lg:col-span-2">
              <div className="card-h">Yearly Impact Factor (2008–2024, dummy values)</div>
              <div className="card-b">
                <InteractiveChart
                  kind="line"
                  data={m.impactFactors}
                  xKey="year"
                  yKeys={[{ key: "JACC" }, { key: "CIRC", name: "Circulation" }, { key: "EHJ" }]}
                />
              </div>
            </div>
            <div className="card">
              <div className="card-h">'Original' articles by journal</div>
              <div className="card-b">
                <InteractiveChart kind="bar" data={m.originalsByJournal} xKey="journal" yKeys={[{ key: "count" }]} />
              </div>
            </div>
            <div className="card">
              <div className="card-h">Citations to 'Original' articles by journal</div>
              <div className="card-b">
                <InteractiveChart
                  kind="bar"
                  data={m.originalCitationsByJournal}
                  xKey="journal"
                  yKeys={[{ key: "count" }]}
                />
              </div>
            </div>
          </div>
        )}
      </section>

      {/* (2) Custom (Pinned) */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold">Custom (Pinned)</h2>
        {deferredPinned.length === 0 && (
          <div className="text-slate-500">No pinned jobs yet. Pin jobs from the Job Lists page.</div>
        )}
        <div className="grid lg:grid-cols-2 gap-6">
          {deferredPinned.slice(0, 6).map((j) => (
            <PinnedCard key={j.id} job={j} rows={pinData[j.id] ?? []} />
          ))}
        </div>
      </section>
    </div>
  );
}

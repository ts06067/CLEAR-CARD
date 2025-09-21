import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "motion/react";
import { useAppDispatch, useAppSelector } from "../../app/hooks";
import { fetchJobs, pollStatuses, togglePinnedLocal } from "./jobsSlice";
import { getResultCsvUrl } from "../../api/jobs";
import PinToggle from "../../components/PinToggle";
import { FileDown, ExternalLink } from "lucide-react";
import LoadingOverlay from "../../components/LoadingOverlay";

function StatusBadge({ s }: { s: string }) {
  const color =
    s === "SUCCEEDED"
      ? "bg-green-100 text-green-800"
      : s === "FAILED"
      ? "bg-red-100 text-red-700"
      : s === "RUNNING"
      ? "bg-blue-100 text-blue-700"
      : "bg-slate-100 text-slate-700";
  return <span className={`px-2 py-0.5 rounded text-xs ${color}`}>{s}</span>;
}

export default function JobsListPage() {
  const dispatch = useAppDispatch();
  const { items, loading } = useAppSelector((s) => s.jobs);
  const user = useAppSelector((s) => s.auth.user);
  const nav = useNavigate();

  // Track expanded Debug JSON per-card
  const [openDebug, setOpenDebug] = useState<Record<string, boolean>>({});
  const toggleDebug = (id: string) =>
    setOpenDebug((s) => ({ ...s, [id]: !s[id] }));

  useEffect(() => {
    dispatch(fetchJobs());
    const id = setInterval(() => dispatch(pollStatuses()), 2500);
    return () => clearInterval(id);
  }, [dispatch]);

  return (
    <div className="p-4 pt-16 space-y-4 overflow-x-hidden">
      <LoadingOverlay open={loading} text="Loading jobs..." />

      <div className="flex items-center">
        <h1 className="text-3xl font-extrabold tracking-tight">Your Jobs</h1>
        <div className="ml-auto">
          <Link className="btn btn-primary" to="/jobs/create">
            + Create
          </Link>
        </div>
      </div>

      {/* Masonry via CSS multi-columns: each child uses break-inside-avoid */}
      <div className="columns-1 md:columns-2 xl:columns-3 gap-4">
        {items.map((j) => {
          const isOpen = !!openDebug[j.id];
          return (
            <motion.div
              key={j.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="break-inside-avoid mb-4"
            >
              <div className="card relative">
                <div className="absolute top-2 right-2">
                  <PinToggle
                    pinned={!!j.pinned}
                    onToggle={() =>
                      dispatch(
                        togglePinnedLocal({ id: j.id, userId: user?.id ?? "anon" })
                      )
                    }
                  />
                </div>

                {/* Header: big title + id next line */}
                <div className="card-h">
                  <div className="font-semibold truncate text-base">
                    {j.title || `Job ${j.id}`}
                  </div>
                  <div className="text-xs text-slate-500 truncate">#{j.id}</div>
                  <div className="mt-1">
                    <StatusBadge s={j.status} />
                  </div>
                </div>

                <div className="card-b space-y-3">
                  <div className="text-xs text-slate-600">
                    <div>
                      <span className="font-medium">Submitted:</span>{" "}
                      {new Date(j.createdAt).toLocaleString()}
                    </div>
                    <div>
                      <span className="font-medium">Completed:</span>{" "}
                      {j.completedAt
                        ? new Date(j.completedAt).toLocaleString()
                        : "-"}
                    </div>
                  </div>

                  {/* Debug JSON toggle (per card only) */}
                  {(j.tableConfig || j.chartConfig) && (
                    <div className="text-xs">
                      <button
                        className="text-slate-500 hover:text-slate-700 underline"
                        onClick={() => toggleDebug(j.id)}
                      >
                        {isOpen ? "▲ Debug JSON" : "▼ Debug JSON"}
                      </button>

                      {isOpen && (
                        <div className="mt-2 space-y-2">
                          {j.tableConfig && (
                            <>
                              <div className="font-medium text-slate-600">
                                table_config
                              </div>
                              <pre className="bg-slate-50 p-2 rounded overflow-auto max-h-48">
                                {JSON.stringify(j.tableConfig, null, 2)}
                              </pre>
                            </>
                          )}
                          {j.chartConfig && (
                            <>
                              <div className="font-medium text-slate-600">
                                chart_config
                              </div>
                              <pre className="bg-slate-50 p-2 rounded overflow-auto max-h-48">
                                {JSON.stringify(j.chartConfig, null, 2)}
                              </pre>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex gap-2">
                    <button
                      className="btn btn-ghost"
                      onClick={() => nav(`/jobs/${j.id}`)}
                    >
                      <ExternalLink className="h-4 w-4 mr-2" /> Details
                    </button>
                    {j.status === "SUCCEEDED" && (
                      <a className="btn btn-ghost" href={getResultCsvUrl(j.id)}>
                        <FileDown className="h-4 w-4 mr-2" /> CSV
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

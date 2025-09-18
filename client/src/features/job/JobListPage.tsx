import { useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "motion/react";
import { useAppDispatch, useAppSelector } from "../../app/hooks";
import { fetchJobs, pollStatuses, togglePinnedLocal } from "./jobsSlice";
import { getResultCsvUrl } from "../../api/jobs";
import PinToggle from "../../components/PinToggle";
import { FileDown, ExternalLink } from "lucide-react";

function StatusBadge({ s }: { s: string }) {
  const color = s==="SUCCEEDED" ? "bg-green-100 text-green-800" :
                s==="FAILED"    ? "bg-red-100 text-red-700" :
                s==="RUNNING"   ? "bg-blue-100 text-blue-700" :
                                  "bg-slate-100 text-slate-700";
  return <span className={`px-2 py-0.5 rounded text-xs ${color}`}>{s}</span>;
}

export default function JobsListPage() {
  const dispatch = useAppDispatch();
  const { items, loading } = useAppSelector(s=>s.jobs);
  const user = useAppSelector(s=>s.auth.user);
  const nav = useNavigate();

  useEffect(()=>{
    dispatch(fetchJobs());
    const id = setInterval(()=>dispatch(pollStatuses()), 2500);
    return ()=>clearInterval(id);
  }, [dispatch]);

  return (
    <div className="space-y-4">
      <div className="flex items-center">
        <h1 className="text-3xl font-extrabold tracking-tight">Your Jobs</h1>
        <div className="ml-auto">
          <Link className="btn btn-primary" to="/jobs/create">+ Create</Link>
        </div>
      </div>

      {loading && <div className="text-slate-500">Loading…</div>}

      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {items.map(j => (
          <motion.div
            key={j.id}
            layout
            initial={{opacity:0, y:8}}
            animate={{opacity:1, y:0}}
            className="card relative"
          >
            <div className="absolute top-2 right-2">
              <PinToggle
                pinned={!!j.pinned}
                onToggle={()=>dispatch(togglePinnedLocal({ id: j.id, userId: user?.id ?? "anon" }))}
              />
            </div>
            <div className="card-h flex items-center gap-2">
              <span className="truncate">{j.title || `Job ${j.id}`}</span>
              <StatusBadge s={j.status}/>
            </div>
            <div className="card-b space-y-3">
              <div className="text-xs text-slate-500">Created: {new Date(j.createdAt).toLocaleString()}</div>
              <div className="flex gap-2">
                <button className="btn btn-ghost" onClick={()=>nav(`/jobs/${j.id}`)}>
                  <ExternalLink className="h-4 w-4 mr-2"/> Details
                </button>
                {j.status==="SUCCEEDED" && (
                  <a className="btn btn-ghost" href={getResultCsvUrl(j.id)}>
                    <FileDown className="h-4 w-4 mr-2"/> CSV
                  </a>
                )}
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

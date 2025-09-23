import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "../../app/hooks";
import { createJob, reset } from "./jobRunSlice";
import ConditionBuilder from "../builder/ConditionBuilder";
import ChartConfigPanel from "../config/ChartConfigPanel";
import { buildSql } from "../../utils/buildSql";
import SqlPreview from "../../components/SqlPreview";
import type { RuleGroupType } from "react-querybuilder";
import type { ChartConfig, AxisField } from "../config/chartConfig";
import LoadingOverlay from "../../components/LoadingOverlay";

export default function CreateJobPage() {
  const [title, setTitle] = useState("");
  const [qb, setQb] = useState<RuleGroupType>({ combinator: "and", rules: [] });
  const [cfg, setCfg] = useState<ChartConfig>({
    x: "cited_pub_year",
    groupBy: ["cited_journal"] as AxisField[],
    orderDir: "ASC",
    yField: "n_article",
    yAgg: "COUNT",
    fitnessBinSize: 10.0,
    citationCountBinSize: 1.0
  });

  const sql = useMemo(() => buildSql(qb, cfg), [qb, cfg]);
  const { submitting, error } = useAppSelector(s=>s.jobRun);
  const dispatch = useAppDispatch();
  const nav = useNavigate();

  return (
    <div className="p-4 pt-16 space-y-4 overflow-x-hidden">
      <LoadingOverlay open={submitting} text="Submitting job…" />

      <h1 className="text-3xl font-extrabold tracking-tight">Create Job</h1>
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 lg:col-span-5 space-y-4">
          <div className="card">
            <div className="card-h">Job Title</div>
            <div className="card-b">
              <input className="input w-full" placeholder="Optional title…" value={title} onChange={(e)=>setTitle(e.target.value)} />
            </div>
          </div>
          <ConditionBuilder query={qb} onChange={setQb} />
          <ChartConfigPanel cfg={cfg} onChange={setCfg} />
        </div>

        <div className="col-span-12 lg:col-span-7 space-y-4">
          <div className="card">
            <div className="card-h">SQL Preview</div>
            <div className="card-b"><SqlPreview sql={sql}/></div>
            <div className="px-4 pb-4 flex gap-2">
              <button
                className="btn btn-primary"
                disabled={submitting}
                onClick={async ()=>{
                  const r:any = await dispatch(createJob({ sql, title, config: { qb, cfg }}));
                  if (r.meta.requestStatus === "fulfilled") {
                    dispatch(reset());
                    nav("/jobs");
                  }
                }}
              >
                {submitting ? "Submitting…" : "Submit & Go to Job Lists"}
              </button>
              <button className="btn btn-ghost" onClick={()=>dispatch(reset())}>Reset</button>
            </div>
            {error && <div className="px-4 pb-4 text-red-600 text-sm">Error: {error}</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

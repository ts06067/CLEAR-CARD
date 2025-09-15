import { useMemo, useState } from "react";
import type { RuleGroupType } from "react-querybuilder";

import ConditionBuilder from "./features/builder/ConditionBuilder";
import ChartConfigPanel from "./features/config/ChartConfigPanel";
import { buildSql } from "./utils/buildSql";
import SqlPreview from "./components/SqlPreview";
import ResultTable from "./components/ResultTable";
import DownloadCsvButton from "./components/DownloadCsvButton";

import { useAppDispatch, useAppSelector } from "./app/hooks";
import { runJob, reset } from "./features/job/jobSlice";
import type { ChartConfig, AxisField } from "./features/config/chartConfig";

type ConditionQuery = RuleGroupType;

export default function App() {
  const dispatch = useAppDispatch();
  const job = useAppSelector((s) => s.job);

  const [qb, setQb] = useState<ConditionQuery>({
    combinator: "and",
    rules: [
      { field: "cited_category", operator: "in", value: "original" },
      { field: "citation_time_days", operator: "<=", value: 365.25 * 2 },
      { field: "cited_pub_year", operator: "between", value: [2008, 2018] }
    ]
  });

  const [cfg, setCfg] = useState<ChartConfig>({
    x: "fitness_percentile_decile",
    groupBy: ["cited_journal", "cited_pub_year"] as AxisField[],
    orderDir: "ASC",
    yField: "n_article",
    yAgg: "COUNT",
    fitnessBinSize: 10.0,
    citationCountBinSize: 1.0
  });

  const sql = useMemo(() => buildSql(qb, cfg), [qb, cfg]);

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="bg-brand text-white px-6 py-3 font-semibold">
        JACC Jobs
      </header>

      <main className="p-4 grid grid-cols-12 gap-4">
        <div className="col-span-12 lg:col-span-5 space-y-4">
          <ConditionBuilder query={qb} onChange={setQb} />
          <ChartConfigPanel cfg={cfg} onChange={(c) => setCfg(c)} />
        </div>

        <div className="col-span-12 lg:col-span-7 space-y-3">
          <div className="rounded-lg border bg-white">
            <div className="px-3 py-2 font-medium text-brand">SQL Preview</div>
            <SqlPreview sql={sql} />
            <div className="p-3 flex gap-2">
              <button
                className="px-3 py-1 rounded bg-brand text-white"
                onClick={() => dispatch(runJob(sql))}
                disabled={job.submitting}
              >
                {job.submitting ? "Submitting…" : "Submit Job"}
              </button>
              <button
                className="px-3 py-1 rounded border"
                onClick={() => dispatch(reset())}
              >
                Reset
              </button>
            </div>
          </div>

          {job.result?.json && (
            <div className="rounded-lg border bg-white">
              <div className="px-3 py-2 font-medium text-brand">
                Result (JSON)
              </div>
              <div className="p-3">
                <ResultTable rows={job.result.json} />
              </div>
              <div className="p-3">
                <DownloadCsvButton url={job.result.csvUrl} />
              </div>
            </div>
          )}

          {job.error && (
            <div className="text-red-700">Error: {job.error}</div>
          )}
        </div>
      </main>
    </div>
  );
}

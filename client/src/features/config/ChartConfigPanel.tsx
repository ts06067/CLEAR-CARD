import { motion } from "motion/react";
import type { ChartConfig, AxisField, Aggregation } from "./chartConfig";

const axisOptions: AxisField[] = [
  "cited_journal",
  "cited_pub_year",
  "cited_pub_month",
  "cited_pub_day",
  "cited_pub_date",
  "cited_eid",
  "cited_category",
  "fitness",
  "citation_count",
  "citation_count_bin_raw",
  "fitness_bin_raw",
  "citation_count_percentile_decile",
  "fitness_percentile_decile"
];

const aggs: Aggregation[] = ["COUNT", "AVG", "MIN", "MAX", "MEDIAN"];

export default function ChartConfigPanel({
  cfg,
  onChange
}: {
  cfg: ChartConfig;
  onChange: (c: ChartConfig) => void;
}) {
  const set = <K extends keyof ChartConfig>(k: K, v: ChartConfig[K]) =>
    onChange({ ...cfg, [k]: v });

  return (
    <motion.div layout className="rounded-lg border border-slate-200 bg-white">
      <div className="px-3 py-2 font-medium text-brand">Chart / Table Config</div>
      <div className="p-3 space-y-3">
        <div className="flex gap-2 items-center">
          <label className="w-24 text-sm">x-axis</label>
          <select
            className="select"
            value={cfg.x}
            onChange={(e) => set("x", e.target.value as AxisField)}
          >
            {axisOptions.map((a) => (
              <option key={a}>{a}</option>
            ))}
          </select>
          <select
            className="select"
            value={cfg.orderDir}
            onChange={(e) => set("orderDir", e.target.value as "ASC" | "DESC")}
          >
            <option>ASC</option>
            <option>DESC</option>
          </select>
        </div>

        <div className="flex gap-2 items-center">
          <label className="w-24 text-sm">group by</label>
          <div className="flex flex-wrap gap-2">
            {axisOptions.map((a) => {
              const active = cfg.groupBy.includes(a);
              return (
                <button
                  key={a}
                  type="button"
                  className={`px-2 py-1 rounded border text-xs ${
                    active ? "bg-brand text-white" : "bg-slate-50"
                  }`}
                  onClick={() => {
                    const next = active
                      ? cfg.groupBy.filter((x) => x !== a)
                      : [...cfg.groupBy, a];
                    set("groupBy", next);
                  }}
                >
                  {a}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex gap-2 items-center">
          <label className="w-24 text-sm">y-axis</label>
          <select
            className="select"
            value={cfg.yField}
            onChange={(e) =>
              set(
                "yField",
                e.target.value as "n_article" | AxisField
              )
            }
          >
            <option value="n_article">n_article (COUNT)</option>
            {axisOptions.map((a) => (
              <option key={a}>{a}</option>
            ))}
          </select>
          {cfg.yField !== "n_article" && (
            <select
              className="select"
              value={cfg.yAgg}
              onChange={(e) => set("yAgg", e.target.value as Aggregation)}
            >
              {aggs.map((a) => (
                <option key={a}>{a}</option>
              ))}
            </select>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm">
            fitness bin size
            <input
              type="number"
              className="input ml-2 w-28"
              value={cfg.fitnessBinSize}
              onChange={(e) => set("fitnessBinSize", Number(e.target.value))}
            />
          </label>
          <label className="text-sm">
            citation_count bin size
            <input
              type="number"
              className="input ml-2 w-28"
              value={cfg.citationCountBinSize}
              onChange={(e) =>
                set("citationCountBinSize", Number(e.target.value))
              }
            />
          </label>
        </div>
      </div>
    </motion.div>
  );
}

import { useMemo, useState } from "react";
//import { motion } from "motion/react";
import { axisCandidates, COUNT_SENTINEL, numericCandidates, validYField } from "./chartConfig";
import type { ChartConfig } from "./chartConfig";
import { FIELDS } from "../builder/fields";

export default function ChartConfigPanel({
  cfg,
  onChange
}: {
  cfg: ChartConfig;
  onChange: (c: ChartConfig) => void;
}) {
  const [groupInput, setGroupInput] = useState("");

  const addGroup = () => {
    if (!groupInput) return;
    if (!cfg.groupBy.includes(groupInput as any)) {
      onChange({ ...cfg, groupBy: [...cfg.groupBy, groupInput as any] });
    }
    setGroupInput("");
  };
  const removeGroup = (g: string) => onChange({ ...cfg, groupBy: cfg.groupBy.filter(x => x !== g) as ChartConfig["groupBy"] });

  const yFieldList = useMemo(() => [COUNT_SENTINEL, ...numericCandidates], []);

  const onYFieldChange = (v: string) => {
    if (!validYField(v, cfg.yAgg)) {
      onChange({ ...cfg, yField: v as any, yAgg: "COUNT" });
    } else {
      onChange({ ...cfg, yField: v as any });
    }
  };

  const onYaggChange = (v: ChartConfig["yAgg"]) => {
    if (!validYField(cfg.yField as string, v)) {
      onChange({ ...cfg, yAgg: v, yField: COUNT_SENTINEL });
    } else {
      onChange({ ...cfg, yAgg: v });
    }
  };

  return (
    <div className="card">
      <div className="card-h">Chart & Grouping</div>
      <div className="card-b space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium">X axis</label>
            <select
              className="select w-full mt-1"
              value={cfg.x}
              onChange={(e)=>onChange({ ...cfg, x: e.target.value as any })}
            >
              {axisCandidates.map(n => <option key={n} value={n}>{labelOf(n)}</option>)}
            </select>
          </div>

          <div>
            <label className="text-sm font-medium">Order by Y</label>
            <select className="select w-full mt-1" value={cfg.orderDir} onChange={(e)=>onChange({ ...cfg, orderDir: e.target.value as "ASC"|"DESC" })}>
              <option value="ASC">Ascending</option>
              <option value="DESC">Descending</option>
            </select>
          </div>

          <div>
            <label className="text-sm font-medium">Y aggregate</label>
            <select className="select w-full mt-1" value={cfg.yAgg} onChange={(e)=>onYaggChange(e.target.value as ChartConfig["yAgg"])}>
              <option value="COUNT">COUNT</option>
              <option value="AVG">AVG</option>
              <option value="MIN">MIN</option>
              <option value="MAX">MAX</option>
              <option value="MEDIAN">MEDIAN</option>
            </select>
          </div>

          <div>
            <label className="text-sm font-medium">Y field</label>
            <select className="select w-full mt-1" value={cfg.yField} onChange={(e)=>onYFieldChange(e.target.value)}>
              {yFieldList.map(n => <option key={n} value={n}>{n === COUNT_SENTINEL ? "COUNT(*)" : labelOf(n)}</option>)}
            </select>
            {cfg.yField !== COUNT_SENTINEL && cfg.yAgg === "COUNT" && (
              <div className="text-xs text-slate-500 mt-1">COUNT selected because Y field is non-numeric.</div>
            )}
          </div>
        </div>

        <div>
          <label className="text-sm font-medium">Group by (series)</label>
          <div className="flex items-center gap-2 mt-1">
            <select className="select" value={groupInput} onChange={(e)=>setGroupInput(e.target.value)}>
              <option value="">— pick a field —</option>
              {axisCandidates.map(n => <option key={n} value={n}>{labelOf(n)}</option>)}
            </select>
            <button className="btn btn-ghost" onClick={addGroup}>Add</button>
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            {cfg.groupBy.map(g => (
              <span
                key={g}
                className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-xs"
              >
                {labelOf(g)}{" "}
                <button className="ml-1 text-slate-500 hover:text-slate-700" onClick={()=>removeGroup(g)}>×</button>
              </span>
            ))}
            {cfg.groupBy.length === 0 && (
              <span className="text-xs text-slate-500">No grouping (single series)</span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium">Fitness bin size</label>
            <input
              className="input w-full mt-1"
              type="number"
              step="0.1"
              value={cfg.fitnessBinSize}
              onChange={(e)=>onChange({ ...cfg, fitnessBinSize: Number(e.target.value) })}
            />
          </div>
          <div>
            <label className="text-sm font-medium">Citation count bin size</label>
            <input
              className="input w-full mt-1"
              type="number"
              step="0.1"
              value={cfg.citationCountBinSize}
              onChange={(e)=>onChange({ ...cfg, citationCountBinSize: Number(e.target.value) })}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function labelOf(name: string): string {
  return FIELDS.find(f => f.name === name)?.label ?? name;
}

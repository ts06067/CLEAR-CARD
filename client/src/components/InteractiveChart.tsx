import React, { memo, useEffect, useMemo, useState } from "react";
import type { ReactElement } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  CartesianGrid,
  ScatterChart,
  Scatter,
  PieChart,
  Pie,
  Cell,
} from "recharts";

export type ChartKind = "line" | "bar" | "scatter" | "pie";

/* ---------------- Palette & helpers ---------------- */
const PALETTE = [
  "#4f46e5", "#10b981", "#f59e0b", "#ef4444", "#06b6d4",
  "#8b5cf6", "#84cc16", "#ec4899", "#14b8a6", "#f97316",
];

const toUpper = (v?: string) => (typeof v === "string" ? v.toUpperCase() : v ?? "");
const seriesName = (name?: string, key?: string) => toUpper(name ?? key ?? "");
const legendFormatter = (value: any) => toUpper(String(value));

const isNumeric = (v: unknown) => {
  const n = Number(v);
  return !Number.isNaN(n) && Number.isFinite(n);
};

function sumBy<T>(arr: T[], fn: (t: T) => number) {
  let s = 0;
  for (const t of arr) {
    const n = Number(fn(t));
    if (!Number.isNaN(n) && Number.isFinite(n)) s += n;
  }
  return s;
}

function minMax(nums: number[]) {
  if (!nums.length) return { min: 0, max: 1 };
  let mn = nums[0], mx = nums[0];
  for (let i = 1; i < nums.length; i++) {
    const v = nums[i];
    if (v < mn) mn = v;
    if (v > mx) mx = v;
  }
  if (mn === mx) {
    // pad a tiny range so axes render nicely
    mn = mn - 1;
    mx = mx + 1;
  }
  return { min: mn, max: mx };
}

function axisLabel(value?: string, isY?: boolean) {
  if (!value) return undefined as any;
  return isY
    ? { value: toUpper(value), angle: -90, position: "insideLeft", offset: 8 }
    : { value: toUpper(value), position: "insideBottom", offset: -2 };
}

/* ---------------- Error boundary ---------------- */
class ChartErrorBoundary extends React.Component<
  { fallback?: React.ReactNode; children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(_err: any) {}
  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="w-full h-full flex items-center justify-center text-sm text-slate-500">
            Unable to render chart.
          </div>
        )
      );
    }
    return this.props.children;
  }
}

/* ---------------- Small UI atoms ---------------- */
function Radio<T extends string>({
  name, value, current, onChange, label,
}: { name: string; value: T; current: T; onChange: (v: T) => void; label: string }) {
  return (
    <label className="inline-flex items-center gap-1.5 cursor-pointer select-none">
      <input
        type="radio"
        name={name}
        value={value}
        checked={current === value}
        onChange={() => onChange(value)}
        className="accent-indigo-600"
      />
      <span className="text-sm capitalize">{label}</span>
    </label>
  );
}

function RangeControls({
  label,
  auto,
  setAuto,
  min,
  max,
  setMin,
  setMax,
  defaults,
  disabled,
}: {
  label: string;
  auto: boolean;
  setAuto: (b: boolean) => void;
  min: number | undefined;
  max: number | undefined;
  setMin: (n: number | undefined) => void;
  setMax: (n: number | undefined) => void;
  defaults: { min: number; max: number };
  disabled?: boolean;
}) {
  return (
    <div className={`flex items-center gap-2 ${disabled ? "opacity-50 pointer-events-none" : ""}`}>
      <span className="text-sm text-slate-600 w-6">{label}</span>
      <label className="inline-flex items-center gap-1 text-sm">
        <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} className="accent-indigo-600" />
        <span>Auto</span>
      </label>
      <input
        type="number"
        className="border rounded px-2 py-1 text-sm w-28"
        value={auto ? defaults.min : (min ?? defaults.min)}
        onChange={(e) => setMin(e.target.value === "" ? undefined : Number(e.target.value))}
        disabled={auto}
      />
      <span className="text-xs text-slate-500">to</span>
      <input
        type="number"
        className="border rounded px-2 py-1 text-sm w-28"
        value={auto ? defaults.max : (max ?? defaults.max)}
        onChange={(e) => setMax(e.target.value === "" ? undefined : Number(e.target.value))}
        disabled={auto}
      />
      {!auto && (
        <button
          type="button"
          className="ml-1 px-2 py-1 rounded border text-xs hover:bg-slate-50"
          onClick={() => { setMin(undefined); setMax(undefined); setAuto(true); }}
        >
          Reset
        </button>
      )}
    </div>
  );
}

/* ---------------- Main component ---------------- */
function InteractiveChart({
  defaultKind = "line",
  data,
  xKey,
  yKeys,
  xLabel,
  yLabel,
}: {
  defaultKind?: ChartKind;
  data: any[];
  xKey: string;
  yKeys: { key: string; name?: string }[];
  xLabel?: string;
  yLabel?: string;
}) {
  /* hooks (always stable) */
  const [kind, setKind] = useState<ChartKind>(defaultKind);

  const safeData = useMemo(() => (Array.isArray(data) ? data : []), [data]);
  const hasSeries = !!(yKeys && yKeys.length);

  // Numeric detection for X
  const xNums = useMemo(() => safeData.map((d) => Number(d?.[xKey])).filter(isNumeric), [safeData, xKey]);
  const numericX = xNums.length === safeData.length && safeData.length > 0;

  // All Y values across series (for default Y range)
  const yNums = useMemo(() => {
    const acc: number[] = [];
    for (const yk of yKeys) {
      for (const d of safeData) {
        const v = Number(d?.[yk.key]);
        if (isNumeric(v)) acc.push(v);
      }
    }
    return acc;
  }, [safeData, yKeys]);

  // Default domains from data
  const xDefaults = useMemo(() => minMax(xNums), [xNums]);
  const yDefaults = useMemo(() => minMax(yNums), [yNums]);

  // User-adjustable domain states (undefined => auto/dataMin/dataMax)
  const [xAuto, setXAuto] = useState(true);
  const [yAuto, setYAuto] = useState(true);
  const [xMin, setXMin] = useState<number | undefined>(undefined);
  const [xMax, setXMax] = useState<number | undefined>(undefined);
  const [yMin, setYMin] = useState<number | undefined>(undefined);
  const [yMax, setYMax] = useState<number | undefined>(undefined);

  // When data changes, if on Auto, keep following defaults
  useEffect(() => {
    if (xAuto) { setXMin(undefined); setXMax(undefined); }
    if (yAuto) { setYMin(undefined); setYMax(undefined); }
  }, [xDefaults, yDefaults, xAuto, yAuto]);

  // Derived sanitized series for scatter
  const scatterSeries = useMemo(() => {
    return yKeys.map((yk) => {
      const pts = safeData
        .map((d) => ({ x: d?.[xKey], y: d?.[yk.key] }))
        .filter((p) => isNumeric(p.x) && isNumeric(p.y))
        .map((p) => ({ x: Number(p.x), y: Number(p.y) }));
      return { key: yk.key, name: seriesName(yk.name, yk.key), points: pts };
    });
  }, [safeData, xKey, yKeys]);

  // Pie slices
  const pieData = useMemo(() => {
    const slices = yKeys.map((yk) => ({
      name: seriesName(yk.name, yk.key),
      value: sumBy(safeData, (d) => Number(d?.[yk.key])),
    }));
    const total = sumBy(slices, (s) => s.value);
    if (!Number.isFinite(total) || total === 0) return [{ name: "TOTAL", value: 0 }];
    return slices;
  }, [safeData, yKeys]);

  const lineBarMargins = { top: 10, right: 30, bottom: 32, left: 10 };
  const scatterMargins = { top: 10, right: 30, bottom: 32, left: 10 };
  const empty = !safeData.length || !xKey || !hasSeries;

  // Build exactly ONE chart element for ResponsiveContainer
  const chartEl: ReactElement = useMemo(() => {
    // Domains: for numeric axes => either user values or dataMin/dataMax
    const xDomain = numericX
      ? [xAuto ? "dataMin" : (xMin ?? xDefaults.min), xAuto ? "dataMax" : (xMax ?? xDefaults.max)]
      : undefined;
    const yDomain = ["auto", "auto"] as any; // we’ll pass domain on YAxis only when numeric; Recharts "auto" + label works
    const yDom = [yAuto ? "auto" : (yMin ?? yDefaults.min), yAuto ? "auto" : (yMax ?? yDefaults.max)] as any;

    switch (kind) {
      case "line":
        return (
          <LineChart data={safeData} margin={lineBarMargins as any}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey={xKey}
              type={numericX ? "number" : "category"}
              domain={numericX ? (xDomain as any) : undefined}
              label={axisLabel(xLabel)}
            />
            <YAxis domain={yDom} label={axisLabel(yLabel, true)} />
            <Tooltip isAnimationActive={false} />
            <Legend formatter={legendFormatter} />
            {yKeys.map((k, i) => (
              <Line
                key={k.key}
                type="monotone"
                dataKey={k.key}
                name={seriesName(k.name, k.key)}
                dot={false}
                strokeWidth={2}
                stroke={PALETTE[i % PALETTE.length]}
                isAnimationActive={false}
                connectNulls
              />
            ))}
          </LineChart>
        );
      case "bar":
        return (
          <BarChart data={safeData} margin={lineBarMargins as any}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey={xKey}
              type={numericX ? "number" : "category"}
              domain={numericX ? (xDomain as any) : undefined}
              label={axisLabel(xLabel)}
            />
            <YAxis domain={yDom} label={axisLabel(yLabel, true)} />
            <Tooltip isAnimationActive={false} />
            <Legend formatter={legendFormatter} />
            {yKeys.map((k, i) => (
              <Bar
                key={k.key}
                dataKey={k.key}
                name={seriesName(k.name, k.key)}
                fill={PALETTE[i % PALETTE.length]}
                isAnimationActive={false}
              />
            ))}
          </BarChart>
        );
      case "scatter":
        return (
          <ScatterChart margin={scatterMargins as any}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="x"
              type={numericX ? "number" : "category"}
              domain={numericX ? (xDomain as any) : undefined}
              name={toUpper(xLabel ?? xKey)}
              label={axisLabel(xLabel)}
            />
            <YAxis
              dataKey="y"
              type="number"
              domain={yDom}
              name={toUpper(yLabel ?? "value")}
              label={axisLabel(yLabel, true)}
            />
            <Tooltip isAnimationActive={false} cursor={{ strokeDasharray: "3 3" }} />
            <Legend formatter={legendFormatter} />
            {scatterSeries.map((s, i) => (
              <Scatter
                key={s.key}
                name={s.name}
                data={s.points}
                fill={PALETTE[i % PALETTE.length]}
                isAnimationActive={false}
              />
            ))}
          </ScatterChart>
        );
      case "pie":
      default:
        return (
          <PieChart>
            <Tooltip isAnimationActive={false} />
            <Legend formatter={legendFormatter} />
            <Pie
              data={pieData}
              dataKey="value"
              nameKey="name"
              isAnimationActive={false}
              innerRadius={"45%"}
              outerRadius={"80%"}
              paddingAngle={1}
            >
              {pieData.map((_, i) => (
                <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
              ))}
            </Pie>
          </PieChart>
        );
    }
  }, [
    kind,
    safeData,
    yKeys,
    xKey,
    xLabel,
    yLabel,
    numericX,
    xAuto,
    yAuto,
    xMin,
    xMax,
    yMin,
    yMax,
    xDefaults.min,
    xDefaults.max,
    yDefaults.min,
    yDefaults.max,
    scatterSeries,
    pieData,
  ]);

  return (
    <div className="w-full overflow-x-hidden">
      {/* Controls row: chart type & ranges */}
      <div className="mb-2 flex flex-wrap items-center gap-4 text-sm">
        <div className="flex items-center gap-3">
          <span className="text-slate-600">Chart:</span>
          <Radio name="chart-kind" value="line" current={kind} onChange={setKind} label="line" />
          <Radio name="chart-kind" value="bar" current={kind} onChange={setKind} label="bar" />
          <Radio name="chart-kind" value="scatter" current={kind} onChange={setKind} label="scatter" />
          <Radio name="chart-kind" value="pie" current={kind} onChange={setKind} label="pie" />
        </div>

        {/* Axis range controls */}
        <div className="flex flex-wrap items-center gap-4">
          {/* X range only if numeric X and not pie */}
          {kind !== "pie" && numericX && (
            <RangeControls
              label="X"
              auto={xAuto}
              setAuto={setXAuto}
              min={xMin}
              max={xMax}
              setMin={setXMin}
              setMax={setXMax}
              defaults={xDefaults}
            />
          )}
          {/* Y range for all cartesian kinds (not pie) */}
          {kind !== "pie" && (
            <RangeControls
              label="Y"
              auto={yAuto}
              setAuto={setYAuto}
              min={yMin}
              max={yMax}
              setMin={setYMin}
              setMax={setYMax}
              defaults={yDefaults}
              disabled={yNums.length === 0}
            />
          )}
        </div>
      </div>

      <div className="w-full h-80 overflow-x-hidden rounded-xl bg-white">
        {(!safeData.length || !xKey || !hasSeries) ? (
          <div className="w-full h-full flex items-center justify-center text-sm text-slate-500">
            No data
          </div>
        ) : (
          <ChartErrorBoundary>
            <ResponsiveContainer>{chartEl}</ResponsiveContainer>
          </ChartErrorBoundary>
        )}
      </div>
    </div>
  );
}

export default memo(InteractiveChart);

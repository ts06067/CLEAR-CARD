import { memo, useMemo } from "react";
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
} from "recharts";

export type ChartKind = "line" | "bar";

function InteractiveChart({
  kind = "line",
  data,
  xKey,
  yKeys,
}: {
  kind?: ChartKind;
  data: any[];
  xKey: string;
  yKeys: { key: string; name?: string }[];
}) {
  // Ensure stable references so Recharts doesn't thrash
  const safeData = useMemo(() => (Array.isArray(data) ? data : []), [data]);
  const hasSeries = yKeys && yKeys.length > 0;
  const margins = useMemo(
    () => (kind === "line" ? { top: 10, right: 30, bottom: 0, left: 0 } : { top: 10, right: 20, bottom: 0, left: 0 }),
    [kind]
  );

  if (!safeData.length || !xKey || !hasSeries) return null;

  return (
    <div className="h-80">
      <ResponsiveContainer>
        {kind === "line" ? (
          <LineChart data={safeData} margin={margins as any}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey={xKey} />
            <YAxis />
            {/* Disable animations to prevent update depth loops in dev */}
            <Tooltip isAnimationActive={false} />
            <Legend />
            {yKeys.map((k) => (
              <Line
                key={k.key}
                type="monotone"
                dataKey={k.key}
                name={k.name ?? k.key}
                dot={false}
                strokeWidth={2}
                isAnimationActive={false}
              />
            ))}
            {/* Removed <Brush> to avoid known StrictMode loops */}
          </LineChart>
        ) : (
          <BarChart data={safeData} margin={margins as any}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey={xKey} />
            <YAxis />
            <Tooltip isAnimationActive={false} />
            <Legend />
            {yKeys.map((k) => (
              <Bar key={k.key} dataKey={k.key} name={k.name ?? k.key} isAnimationActive={false} />
            ))}
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

export default memo(InteractiveChart);

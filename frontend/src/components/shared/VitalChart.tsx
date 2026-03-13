import React from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import type { VitalReading, Baseline } from "@/types";
import { GlassCard } from "./GlassCard";

interface Props {
  readings: VitalReading[];
  baseline: Baseline | null;
  metric: "heart_rate" | "spo2" | "systolic_bp" | "temperature";
  title: string;
  unit: string;
  color: string;
}

const metricToBaselineKey: Record<string, keyof Baseline> = {
  heart_rate: "heart_rate",
  spo2: "spo2",
  systolic_bp: "systolic_bp",
  temperature: "temperature",
};

const MAX_POINTS = 20;
const RECENT_WINDOW_MS = 10 * 60 * 1000;

export function VitalChart({
  readings,
  baseline,
  metric,
  title,
  unit,
  color,
}: Props): React.ReactElement {
  const formatRelativeTime = (timestamp: number, latestTimestamp: number): string => {
    if (!Number.isFinite(timestamp) || timestamp <= 0) return "--";
    if (!Number.isFinite(latestTimestamp) || latestTimestamp <= 0) return "--";

    const deltaSec = Math.max(0, Math.round((latestTimestamp - timestamp) / 1000));
    if (deltaSec <= 1) return "now";
    if (deltaSec < 60) return `${deltaSec}s ago`;

    const minutes = Math.floor(deltaSec / 60);
    const seconds = deltaSec % 60;
    return `${minutes}m ${seconds}s ago`;
  };

  const sortedReadings = [...readings]
    .sort((a, b) => {
      const aTime = a.recorded_at ? new Date(a.recorded_at).getTime() : 0;
      const bTime = b.recorded_at ? new Date(b.recorded_at).getTime() : 0;
      return aTime - bTime;
    });

  const latestTimestamp =
    sortedReadings.length > 0
      ? sortedReadings.reduce((latest, reading) => {
          const ts = reading.recorded_at
            ? new Date(reading.recorded_at).getTime()
            : 0;
          return ts > latest ? ts : latest;
        }, 0)
      : 0;

  const data = sortedReadings
    .filter((reading) => {
      const ts = reading.recorded_at ? new Date(reading.recorded_at).getTime() : 0;
      if (ts <= 0 || latestTimestamp <= 0) {
        return true;
      }
      return ts >= latestTimestamp - RECENT_WINDOW_MS;
    })
    .slice(-MAX_POINTS)
    .map((r, i) => ({
      index: i,
      value: r[metric],
      ts: r.recorded_at ? new Date(r.recorded_at).getTime() : i * 1000,
    }));

  const baselineValue = baseline ? baseline[metricToBaselineKey[metric]] : null;

  return (
    <GlassCard>
      <h3 className="text-sm font-medium text-white/70 mb-3">
        {title} ({unit})
      </h3>
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="rgba(255,255,255,0.05)"
            />
            <XAxis
              dataKey="ts"
              type="number"
              domain={["dataMin", "dataMax"]}
              tickFormatter={(value) =>
                formatRelativeTime(Number(value), latestTimestamp)
              }
              tickCount={6}
              minTickGap={24}
              tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }}
            />
            <YAxis
              tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }}
              domain={["auto", "auto"]}
            />
            <Tooltip
              labelFormatter={(label) => {
                const ts = Number(label);
                const absolute = Number.isFinite(ts)
                  ? new Date(ts).toLocaleTimeString()
                  : "--";
                const relative = formatRelativeTime(ts, latestTimestamp);
                return `${absolute} (${relative})`;
              }}
              contentStyle={{
                backgroundColor: "rgba(17,24,39,0.95)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: "8px",
                color: "#fff",
              }}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke={color}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: color }}
            />
            {baselineValue !== null && typeof baselineValue === "number" && (
              <ReferenceLine
                y={baselineValue}
                stroke="rgba(255,255,255,0.3)"
                strokeDasharray="5 5"
                label={{
                  value: "Baseline",
                  fill: "rgba(255,255,255,0.3)",
                  fontSize: 10,
                }}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </GlassCard>
  );
}

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

export function VitalChart({
  readings,
  baseline,
  metric,
  title,
  unit,
  color,
}: Props): React.ReactElement {
  const data = readings.map((r, i) => ({
    index: i,
    value: r[metric],
    time: r.recorded_at
      ? new Date(r.recorded_at).toLocaleTimeString()
      : `#${i + 1}`,
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
              dataKey="time"
              tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }}
            />
            <YAxis
              tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }}
              domain={["auto", "auto"]}
            />
            <Tooltip
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

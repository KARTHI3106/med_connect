import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

const THRESHOLDS = {
  heart_rate: { low: 50, high: 120, critical_low: 40, critical_high: 150 },
  spo2: { low: 92, critical_low: 88 },
  systolic_bp: { low: 90, high: 140, critical_low: 80, critical_high: 180 },
  diastolic_bp: { low: 60, high: 90, critical_high: 120 },
  temperature: { low: 35.5, high: 38.0, critical_high: 39.5 },
};

const VitalReadingSchema = z.object({
  heart_rate: z.number(),
  spo2: z.number(),
  systolic_bp: z.number(),
  diastolic_bp: z.number(),
  temperature: z.number(),
  activity_level: z.enum(["resting", "sleeping", "exercising"]).optional(),
});

type VitalReading = z.infer<typeof VitalReadingSchema>;

const BaselineSchema = z
  .object({
    heart_rate: z.number(),
    spo2: z.number(),
    systolic_bp: z.number(),
    diastolic_bp: z.number().optional(),
    temperature: z.number(),
    samples_count: z.number().int().optional(),
  })
  .partial();

type Baseline = z.infer<typeof BaselineSchema>;

function scoreToLevel(score: number): RiskLevel {
  if (score >= 70) return "CRITICAL";
  if (score >= 45) return "HIGH";
  if (score >= 20) return "MEDIUM";
  return "LOW";
}

function getRecommendation(level: RiskLevel): string {
  switch (level) {
    case "CRITICAL":
      return "Seek immediate medical attention or contact emergency services.";
    case "HIGH":
      return "Contact your doctor and rest. Monitor vitals closely.";
    case "MEDIUM":
      return "Monitor your symptoms and recheck vitals soon.";
    default:
      return "Continue regular monitoring.";
  }
}

function evaluateThresholds(v: VitalReading, factors: string[]): number {
  let score = 0;

  if (
    v.heart_rate <= THRESHOLDS.heart_rate.critical_low ||
    v.heart_rate >= THRESHOLDS.heart_rate.critical_high
  ) {
    score += 35;
    factors.push(`Heart rate ${v.heart_rate} bpm is critically abnormal`);
  } else if (
    v.heart_rate <= THRESHOLDS.heart_rate.low ||
    v.heart_rate >= THRESHOLDS.heart_rate.high
  ) {
    score += 15;
    factors.push(`Heart rate ${v.heart_rate} bpm is outside normal range`);
  }

  if (v.spo2 <= THRESHOLDS.spo2.critical_low) {
    score += 40;
    factors.push(`SpO2 ${v.spo2}% is dangerously low`);
  } else if (v.spo2 <= THRESHOLDS.spo2.low) {
    score += 20;
    factors.push(`SpO2 ${v.spo2}% is below safe threshold`);
  }

  if (
    v.systolic_bp <= THRESHOLDS.systolic_bp.critical_low ||
    v.systolic_bp >= THRESHOLDS.systolic_bp.critical_high
  ) {
    score += 30;
    factors.push(`Systolic BP ${v.systolic_bp} mmHg is critically abnormal`);
  } else if (
    v.systolic_bp <= THRESHOLDS.systolic_bp.low ||
    v.systolic_bp >= THRESHOLDS.systolic_bp.high
  ) {
    score += 12;
    factors.push(`Systolic BP ${v.systolic_bp} mmHg is outside normal range`);
  }

  if (v.diastolic_bp >= THRESHOLDS.diastolic_bp.critical_high) {
    score += 25;
    factors.push(`Diastolic BP ${v.diastolic_bp} mmHg is critically high`);
  } else if (
    v.diastolic_bp <= THRESHOLDS.diastolic_bp.low ||
    v.diastolic_bp >= THRESHOLDS.diastolic_bp.high
  ) {
    score += 10;
    factors.push(`Diastolic BP ${v.diastolic_bp} mmHg is outside normal range`);
  }

  if (v.temperature >= THRESHOLDS.temperature.critical_high) {
    score += 25;
    factors.push(`Temperature ${v.temperature}C is dangerously high`);
  } else if (
    v.temperature <= THRESHOLDS.temperature.low ||
    v.temperature >= THRESHOLDS.temperature.high
  ) {
    score += 10;
    factors.push(`Temperature ${v.temperature}C is outside normal range`);
  }

  return score;
}

function evaluateContext(v: VitalReading, factors: string[]): number {
  let adjustment = 0;

  if (
    v.activity_level === "exercising" &&
    v.heart_rate > 120 &&
    v.heart_rate < 170
  ) {
    adjustment -= 15;
    factors.push("Elevated heart rate adjusted for exercise context");
  }

  if (
    v.activity_level === "sleeping" &&
    v.heart_rate >= 45 &&
    v.heart_rate <= 55
  ) {
    adjustment -= 10;
    factors.push("Lower heart rate adjusted for sleep context");
  }

  return adjustment;
}

function evaluateBaselineDeviation(
  v: VitalReading,
  baseline: Baseline,
  factors: string[],
): number {
  let score = 0;

  const deviations = [
    {
      name: "Heart rate",
      current: v.heart_rate,
      base: baseline.heart_rate,
      unit: "bpm",
      weight: 1.0,
    },
    {
      name: "SpO2",
      current: v.spo2,
      base: baseline.spo2,
      unit: "%",
      weight: 1.5,
    },
    {
      name: "Systolic BP",
      current: v.systolic_bp,
      base: baseline.systolic_bp,
      unit: "mmHg",
      weight: 0.8,
    },
    {
      name: "Temperature",
      current: v.temperature,
      base: baseline.temperature,
      unit: "C",
      weight: 1.2,
    },
  ].filter((d) => typeof d.base === "number") as Array<{
    name: string;
    current: number;
    base: number;
    unit: string;
    weight: number;
  }>;

  for (const d of deviations) {
    const diff = Math.abs(d.current - d.base);
    const estimatedSD = d.base * 0.1 || 1;
    const zScore = diff / estimatedSD;

    if (zScore > 3.5) {
      score += 15 * d.weight;
      factors.push(
        `${d.name} ${d.current}${d.unit} is far from baseline ${d.base.toFixed(1)}${d.unit}`,
      );
    } else if (zScore > 2.5) {
      score += 8 * d.weight;
      factors.push(`${d.name} deviates significantly from baseline`);
    }
  }

  return Math.round(score);
}

function evaluateVitals(
  vitals: VitalReading,
  baseline?: Baseline,
): {
  risk_level: RiskLevel;
  risk_score: number;
  contributing_factors: string[];
  recommended_action: string;
} {
  const factors: string[] = [];
  let score = 0;

  score += evaluateThresholds(vitals, factors);
  score += evaluateContext(vitals, factors);

  if (
    baseline &&
    baseline.heart_rate &&
    baseline.spo2 &&
    baseline.systolic_bp &&
    baseline.temperature
  ) {
    score += evaluateBaselineDeviation(vitals, baseline, factors);
  }

  score = Math.max(0, Math.min(100, score));
  const level = scoreToLevel(score);

  return {
    risk_level: level,
    risk_score: Math.round(score),
    contributing_factors: factors,
    recommended_action: getRecommendation(level),
  };
}

const server = new McpServer({ name: "clinical-rules-mcp", version: "0.1.0" });

server.registerTool(
  "risk.evaluateVitals",
  {
    title: "Evaluate Vitals",
    description:
      "Deterministically evaluates a vitals reading against thresholds (and optional baseline).",
    inputSchema: z.object({
      vitals: VitalReadingSchema,
      baseline: BaselineSchema.optional(),
    }),
    outputSchema: z.object({
      risk_level: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
      risk_score: z.number().int().min(0).max(100),
      contributing_factors: z.array(z.string()),
      recommended_action: z.string(),
    }),
  },
  async ({ vitals, baseline }) => {
    const out = evaluateVitals(vitals, baseline);
    return {
      content: [{ type: "text", text: JSON.stringify(out, null, 2) }],
      structuredContent: out,
    };
  },
);

server.registerTool(
  "alerts.shouldEscalate",
  {
    title: "Escalation Decision",
    description: "Returns escalation targets given risk level/score.",
    inputSchema: z.object({
      risk_level: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
      risk_score: z.number().int().min(0).max(100).optional(),
    }),
  },
  async ({ risk_level, risk_score }) => {
    const level: RiskLevel = risk_level || scoreToLevel(risk_score ?? 0);

    const decision = {
      risk_level: level,
      notify_patient: level !== "LOW",
      notify_doctor: level === "HIGH" || level === "CRITICAL",
      notify_caregiver: level === "CRITICAL",
      urgency:
        level === "CRITICAL"
          ? "immediate"
          : level === "HIGH"
            ? "same_day"
            : "routine",
    };

    return {
      content: [{ type: "text", text: JSON.stringify(decision, null, 2) }],
      structuredContent: decision,
    };
  },
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

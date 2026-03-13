import { randomUUID } from "node:crypto";
import { inMemoryDb } from "../config/database.js";
import { BaselineService, Baseline } from "./baseline.service.js";
import { IngestionService, VitalReading } from "./ingestion.service.js";

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface RiskAssessment {
  id: string;
  patient_id: string;
  risk_level: RiskLevel;
  risk_score: number;
  confidence: "LOW" | "MEDIUM" | "HIGH";
  reason: string;
  contributing_factors: string[];
  trend_summary: string;
  recommended_action: string;
  assessed_at: string;
}

const THRESHOLDS = {
  heart_rate: { low: 50, high: 120, critical_low: 40, critical_high: 150 },
  spo2: { low: 92, critical_low: 88 },
  systolic_bp: { low: 90, high: 140, critical_low: 80, critical_high: 180 },
  diastolic_bp: { low: 60, high: 90, critical_high: 120 },
  temperature: { low: 35.5, high: 38.0, critical_high: 39.5 },
};

export class RiskService {
  static async evaluate(
    patientId: string,
    current: VitalReading,
  ): Promise<RiskAssessment> {
    const baseline = await BaselineService.getBaseline(patientId);
    const recent = IngestionService.getRecentReadings(patientId);

    const factors: string[] = [];
    let score = 0;

    score += this.evaluateThresholds(current, factors);
    score += this.evaluateTrends(current, recent, factors);

    if (baseline && baseline.samples_count > 5) {
      score += this.evaluateBaselineDeviation(current, baseline, factors);
    }

    score += this.evaluateContext(current, factors);

    score = Math.max(0, Math.min(100, score));

    const risk_level = this.scoreToLevel(score);
    const confidence =
      recent.length > 10 ? "HIGH" : recent.length > 3 ? "MEDIUM" : "LOW";

    const assessment: RiskAssessment = {
      id: randomUUID(),
      patient_id: patientId,
      risk_level,
      risk_score: Math.round(score),
      confidence,
      reason: this.buildReason(factors, risk_level),
      contributing_factors: factors,
      trend_summary: this.buildTrendSummary(recent, current),
      recommended_action: this.getRecommendation(risk_level),
      assessed_at: new Date().toISOString(),
    };

    inMemoryDb.riskAssessments.set(assessment.id, assessment);

    return assessment;
  }

  static async getLatestAssessment(
    patientId: string,
  ): Promise<RiskAssessment | null> {
    const all = Array.from(inMemoryDb.riskAssessments.values())
      .filter((r: RiskAssessment) => r.patient_id === patientId)
      .sort(
        (a: RiskAssessment, b: RiskAssessment) =>
          new Date(b.assessed_at).getTime() - new Date(a.assessed_at).getTime(),
      );
    return all.length > 0 ? all[0] : null;
  }

  private static evaluateThresholds(
    v: VitalReading,
    factors: string[],
  ): number {
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
      factors.push(
        `Diastolic BP ${v.diastolic_bp} mmHg is outside normal range`,
      );
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

  private static evaluateTrends(
    current: VitalReading,
    recent: Array<{
      heart_rate: number;
      spo2: number;
      systolic_bp: number;
      diastolic_bp: number;
    }>,
    factors: string[],
  ): number {
    if (recent.length < 3) return 0;

    let score = 0;
    const last5 = recent.slice(-5);

    const spo2Trend = current.spo2 - last5[0].spo2;
    if (spo2Trend <= -4) {
      score += 20;
      factors.push(
        `SpO2 dropped ${Math.abs(spo2Trend).toFixed(1)}% in recent readings`,
      );
    } else if (spo2Trend <= -2) {
      score += 10;
      factors.push(
        `SpO2 declining trend: ${Math.abs(spo2Trend).toFixed(1)}% drop`,
      );
    }

    const hrTrend = current.heart_rate - last5[0].heart_rate;
    if (Math.abs(hrTrend) > 30) {
      score += 15;
      factors.push(
        `Heart rate changed by ${hrTrend > 0 ? "+" : ""}${hrTrend.toFixed(0)} bpm recently`,
      );
    } else if (Math.abs(hrTrend) > 15) {
      score += 8;
      factors.push(
        `Heart rate trending ${hrTrend > 0 ? "up" : "down"} by ${Math.abs(hrTrend).toFixed(0)} bpm`,
      );
    }

    const bpTrend = current.systolic_bp - last5[0].systolic_bp;
    if (Math.abs(bpTrend) > 25) {
      score += 12;
      factors.push(
        `Systolic BP changed by ${bpTrend > 0 ? "+" : ""}${bpTrend.toFixed(0)} mmHg recently`,
      );
    }

    return score;
  }

  private static evaluateBaselineDeviation(
    current: VitalReading,
    baseline: Baseline,
    factors: string[],
  ): number {
    let score = 0;

    const deviations = [
      {
        name: "Heart rate",
        current: current.heart_rate,
        base: baseline.heart_rate,
        unit: "bpm",
        weight: 1.0,
      },
      {
        name: "SpO2",
        current: current.spo2,
        base: baseline.spo2,
        unit: "%",
        weight: 1.5,
      },
      {
        name: "Systolic BP",
        current: current.systolic_bp,
        base: baseline.systolic_bp,
        unit: "mmHg",
        weight: 0.8,
      },
      {
        name: "Temperature",
        current: current.temperature,
        base: baseline.temperature,
        unit: "C",
        weight: 1.2,
      },
    ];

    for (const d of deviations) {
      const diff = Math.abs(d.current - d.base);
      const estimatedSD = d.base * 0.1 || 1;
      const zScore = diff / estimatedSD;

      if (zScore > 3.5) {
        score += 15 * d.weight;
        factors.push(
          `${d.name} ${d.current}${d.unit} is far from patient baseline ${d.base.toFixed(1)}${d.unit}`,
        );
      } else if (zScore > 2.5) {
        score += 8 * d.weight;
        factors.push(`${d.name} deviates significantly from baseline`);
      }
    }

    return Math.round(score);
  }

  private static evaluateContext(
    current: VitalReading,
    factors: string[],
  ): number {
    let adjustment = 0;

    if (
      current.activity_level === "exercising" &&
      current.heart_rate > 120 &&
      current.heart_rate < 170
    ) {
      adjustment -= 15;
      factors.push("Elevated heart rate adjusted for exercise context");
    }

    if (
      current.activity_level === "sleeping" &&
      current.heart_rate >= 45 &&
      current.heart_rate <= 55
    ) {
      adjustment -= 10;
      factors.push("Lower heart rate adjusted for sleep context");
    }

    return adjustment;
  }

  private static scoreToLevel(score: number): RiskLevel {
    if (score >= 70) return "CRITICAL";
    if (score >= 45) return "HIGH";
    if (score >= 20) return "MEDIUM";
    return "LOW";
  }

  private static buildReason(factors: string[], level: RiskLevel): string {
    if (factors.length === 0) return "Vitals within normal ranges";
    if (level === "CRITICAL") return `Critical risk: ${factors[0]}`;
    if (level === "HIGH") return `High risk: ${factors[0]}`;
    return factors[0];
  }

  private static buildTrendSummary(
    recent: Array<{ spo2: number; heart_rate: number }>,
    current: VitalReading,
  ): string {
    if (recent.length < 3) return "Not enough data to detect trends yet.";
    const first = recent[0];
    const spo2Change = current.spo2 - first.spo2;
    const hrChange = current.heart_rate - first.heart_rate;
    return `Recent trend: SpO2 ${spo2Change >= 0 ? "+" : ""}${spo2Change.toFixed(1)}%, HR ${hrChange >= 0 ? "+" : ""}${hrChange.toFixed(0)} bpm`;
  }

  private static getRecommendation(level: RiskLevel): string {
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
}

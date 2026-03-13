import { randomUUID } from "node:crypto";
import { inMemoryDb } from "../config/database.js";
import type { RiskLevel } from "./risk.service.js";

export interface HealthScore {
  score: number;
  components: {
    vitals: number;
    trend: number;
    baseline: number;
    activity: number;
  };
}

export class HealthScoreService {
  private static clamp(value: number, min = 0, max = 100): number {
    return Math.min(max, Math.max(min, value));
  }

  static calculate(
    riskScore: number,
    activityLevel: string,
    riskLevel: RiskLevel,
  ): HealthScore {
    const normalizedRisk = this.clamp(
      Number.isFinite(riskScore) ? riskScore : 0,
    );

    const severityPenalty =
      riskLevel === "CRITICAL"
        ? 0
        : riskLevel === "HIGH"
          ? 8
          : riskLevel === "MEDIUM"
            ? 3
            : 0;

    const activityAdjustment =
      riskLevel === "LOW" || riskLevel === "MEDIUM"
        ? activityLevel === "walking" || activityLevel === "exercising"
          ? 4
          : 0
        : 0;

    const rawScore =
      100 - normalizedRisk - severityPenalty + activityAdjustment;

    // Keep severe states clearly reflected in the score to avoid misleading UI.
    const cappedForSeverity =
      riskLevel === "CRITICAL"
        ? Math.min(rawScore, 39)
        : riskLevel === "HIGH"
          ? Math.min(rawScore, 69)
          : rawScore;

    const score = this.clamp(cappedForSeverity);

    const vitalsComponent = this.clamp(
      100 - normalizedRisk * 1.0 - severityPenalty * 0.3,
    );
    const trendComponent = this.clamp(
      100 - normalizedRisk * 0.85 - severityPenalty * 0.4,
    );
    const baselineComponent = this.clamp(
      100 - normalizedRisk * 0.7 - severityPenalty * 0.4,
    );
    const activityComponent =
      riskLevel === "CRITICAL"
        ? 25
        : riskLevel === "HIGH"
          ? 40
          : activityLevel === "walking" || activityLevel === "exercising"
            ? 80
            : 60;

    return {
      score: Math.round(score),
      components: {
        vitals: Math.round(vitalsComponent),
        trend: Math.round(trendComponent),
        baseline: Math.round(baselineComponent),
        activity: Math.round(activityComponent),
      },
    };
  }

  static async save(
    patientId: string,
    healthScore: HealthScore,
  ): Promise<void> {
    const id = randomUUID();
    const record = {
      id,
      patient_id: patientId,
      score: healthScore.score,
      components: healthScore.components,
      calculated_at: new Date().toISOString(),
    };

    inMemoryDb.healthScores.set(id, record);
  }

  static async getLatest(patientId: string): Promise<HealthScore | null> {
    const all = Array.from(inMemoryDb.healthScores.values())
      .filter((h: any) => h.patient_id === patientId)
      .sort(
        (a: any, b: any) =>
          new Date(b.calculated_at).getTime() -
          new Date(a.calculated_at).getTime(),
      );
    return all.length > 0
      ? { score: all[0].score, components: all[0].components }
      : null;
  }
}

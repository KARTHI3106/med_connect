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

  private static mapScoreByRiskLevel(
    normalizedRisk: number,
    activityLevel: string,
    riskLevel: RiskLevel,
  ): number {
    const activityBonus =
      activityLevel === "walking" || activityLevel === "exercising" ? 3 : 0;

    if (riskLevel === "CRITICAL") {
      return this.clamp(74 - normalizedRisk * 0.65, 8, 39);
    }

    if (riskLevel === "HIGH") {
      return this.clamp(86 - normalizedRisk * 0.9, 30, 69);
    }

    if (riskLevel === "MEDIUM") {
      return this.clamp(92 - normalizedRisk * 0.9 + activityBonus, 55, 84);
    }

    return this.clamp(100 - normalizedRisk * 0.8 + 6 + activityBonus, 80, 100);
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
      riskLevel === "CRITICAL" ? 12 : riskLevel === "HIGH" ? 8 : 3;

    const score = this.mapScoreByRiskLevel(
      normalizedRisk,
      activityLevel,
      riskLevel,
    );

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

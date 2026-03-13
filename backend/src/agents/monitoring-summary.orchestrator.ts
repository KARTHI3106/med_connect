import { inMemoryDb } from "../config/database.js";
import { IngestionService } from "../services/ingestion.service.js";
import { RiskService } from "../services/risk.service.js";
import { BaselineService } from "../services/baseline.service.js";
import { AlertService } from "../services/alert.service.js";
import { HealthScoreService } from "../services/health-score.service.js";
import aiAgentService from "../services/ai-agent.service.js";

export interface MonitoringSummary {
  patient: {
    id: string;
    name: string;
    phone?: string;
  };
  latest_reading: unknown | null;
  baseline: unknown | null;
  latest_risk: unknown | null;
  active_alerts: unknown[];
  latest_health_score: unknown | null;
  risk_explanation: unknown | null;
}

function resolvePatientDisplay(patientId: string): {
  id: string;
  name: string;
  phone?: string;
} {
  const patientRecord = Array.from(inMemoryDb.patients.values()).find(
    (p: any) => p.user_id === patientId || p.id === patientId,
  );

  const user = patientRecord
    ? inMemoryDb.users.get(patientRecord.user_id)
    : inMemoryDb.users.get(patientId);

  return {
    id: patientRecord?.user_id || patientId,
    name: user?.name || patientRecord?.full_name || "Unknown",
    phone: user?.phone || undefined,
  };
}

export async function buildMonitoringSummary(
  patientId: string,
): Promise<MonitoringSummary> {
  const patient = resolvePatientDisplay(patientId);

  const recent = IngestionService.getRecentReadings(patientId);
  const latestReading = recent.length > 0 ? recent[recent.length - 1] : null;

  const baseline = await BaselineService.getBaseline(patientId);
  const latestRisk = await RiskService.getLatestAssessment(patientId);

  const activeAlerts = await AlertService.getAlertsForPatient(patientId);
  const latestHealthScore = await HealthScoreService.getLatest(patientId);

  let riskExplanation: unknown | null = null;
  if (latestRisk && latestReading) {
    try {
      riskExplanation = await aiAgentService.explainRisk(
        latestRisk as any,
        latestReading as any,
        (baseline as any) ?? null,
      );
    } catch {
      riskExplanation = null;
    }
  }

  return {
    patient,
    latest_reading: latestReading,
    baseline,
    latest_risk: latestRisk,
    active_alerts: activeAlerts,
    latest_health_score: latestHealthScore,
    risk_explanation: riskExplanation,
  };
}

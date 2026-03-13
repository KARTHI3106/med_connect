import { randomUUID } from "node:crypto";
import { inMemoryDb } from "../config/database.js";
import { RiskAssessment, RiskLevel } from "./risk.service.js";

export interface AlertEvent {
  id: string;
  patient_id: string;
  risk_assessment_id: string;
  alert_level: RiskLevel;
  message: string;
  notified: string[];
  acknowledged_by: string | null;
  acknowledged_at: string | null;
  escalated: boolean;
  resolved: boolean;
  resolved_at: string | null;
  created_at: string;
}

const lastAlertLevel = new Map<string, RiskLevel>();

export class AlertService {
  static async processRiskAssessment(
    assessment: RiskAssessment,
  ): Promise<AlertEvent | null> {
    const previous = lastAlertLevel.get(assessment.patient_id);

    if (
      previous === assessment.risk_level &&
      assessment.risk_level !== "CRITICAL"
    ) {
      return null;
    }

    if (assessment.risk_level === "LOW") {
      lastAlertLevel.set(assessment.patient_id, "LOW");
      return null;
    }

    lastAlertLevel.set(assessment.patient_id, assessment.risk_level);

    const notified = this.getNotificationTargets(assessment.risk_level);

    const alert: AlertEvent = {
      id: randomUUID(),
      patient_id: assessment.patient_id,
      risk_assessment_id: assessment.id,
      alert_level: assessment.risk_level,
      message: assessment.reason,
      notified,
      acknowledged_by: null,
      acknowledged_at: null,
      escalated: assessment.risk_level === "CRITICAL",
      resolved: false,
      resolved_at: null,
      created_at: new Date().toISOString(),
    };

    inMemoryDb.alertEvents.set(alert.id, alert);

    return alert;
  }

  static async acknowledgeAlert(
    alertId: string,
    userId: string,
  ): Promise<AlertEvent | null> {
    const alert = inMemoryDb.alertEvents.get(alertId);
    if (!alert) return null;
    alert.acknowledged_by = userId;
    alert.acknowledged_at = new Date().toISOString();
    return alert;
  }

  static async resolveAlert(alertId: string): Promise<AlertEvent | null> {
    const alert = inMemoryDb.alertEvents.get(alertId);
    if (!alert) return null;
    alert.resolved = true;
    alert.resolved_at = new Date().toISOString();
    return alert;
  }

  static async getAlertsForPatient(patientId: string): Promise<AlertEvent[]> {
    return Array.from(inMemoryDb.alertEvents.values())
      .filter((a: AlertEvent) => a.patient_id === patientId)
      .sort(
        (a: AlertEvent, b: AlertEvent) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
  }

  static async getAllActiveAlerts(): Promise<AlertEvent[]> {
    return Array.from(inMemoryDb.alertEvents.values())
      .filter((a: AlertEvent) => !a.resolved)
      .sort((a: AlertEvent, b: AlertEvent) => {
        const levelOrder: Record<string, number> = {
          CRITICAL: 0,
          HIGH: 1,
          MEDIUM: 2,
          LOW: 3,
        };
        return (
          (levelOrder[a.alert_level] || 3) - (levelOrder[b.alert_level] || 3)
        );
      });
  }

  private static getNotificationTargets(level: RiskLevel): string[] {
    switch (level) {
      case "CRITICAL":
        return ["patient", "doctor", "caregiver"];
      case "HIGH":
        return ["patient", "doctor"];
      case "MEDIUM":
        return ["patient"];
      default:
        return [];
    }
  }
}

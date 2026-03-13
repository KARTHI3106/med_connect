import type { Server as SocketServer } from "socket.io";
import type { VitalReading } from "../services/ingestion.service.js";
import type { RiskAssessment } from "../services/risk.service.js";
import type { HealthScore } from "../services/health-score.service.js";
import type { AlertEvent } from "../services/alert.service.js";

interface AutoPrescriptionEvent {
  alertId: string;
  patientId: string;
  prescription: {
    id: string;
    diagnosis: string;
    medicines: Array<{
      name: string;
      dosage?: string;
      frequency?: string;
      duration?: string;
      quantity?: number;
    }>;
    blockchainHash: string;
    createdAt: string;
    aiPowered: boolean;
  };
}

let io: SocketServer | null = null;

export function registerSocketServer(server: SocketServer): void {
  io = server;
}

export function emitVitalsUpdate(payload: {
  patientId: string;
  reading: VitalReading;
  risk: RiskAssessment;
  healthScore: HealthScore;
}): void {
  if (!io) return;

  const vitalsPayload = {
    reading: payload.reading,
    risk: payload.risk,
    health_score: payload.healthScore,
  };

  io.to(`patient:${payload.patientId}`).emit("vitals:update", vitalsPayload);
  io.to("doctors").emit("vitals:update", {
    patient_id: payload.patientId,
    ...vitalsPayload,
  });
  io.to("caregivers").emit("vitals:update", {
    patient_id: payload.patientId,
    ...vitalsPayload,
  });
}

export function emitNewAlert(alert: AlertEvent): void {
  if (!io) return;

  io.to(`patient:${alert.patient_id}`).emit("alert:new", alert);
  io.to("doctors").emit("alert:new", alert);
  if (alert.escalated) {
    io.to("caregivers").emit("alert:new", alert);
  }
}

export function emitAlertUpdated(alert: AlertEvent): void {
  if (!io) return;

  io.to(`patient:${alert.patient_id}`).emit("alert:updated", alert);
  io.to("doctors").emit("alert:updated", alert);
  io.to("caregivers").emit("alert:updated", alert);
}

export function emitAutoPrescriptionCreated(
  payload: AutoPrescriptionEvent,
): void {
  if (!io) return;

  io.to(`patient:${payload.patientId}`).emit(
    "prescription:auto-created",
    payload,
  );
  io.to("doctors").emit("prescription:auto-created", payload);
  io.to("caregivers").emit("prescription:auto-created", payload);
}

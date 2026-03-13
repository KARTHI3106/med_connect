import { Server as SocketServer, Socket } from "socket.io";
import {
  IngestionService,
  VitalReading,
} from "../services/ingestion.service.js";
import { RiskService } from "../services/risk.service.js";
import { AlertService } from "../services/alert.service.js";
import { BaselineService } from "../services/baseline.service.js";
import { HealthScoreService } from "../services/health-score.service.js";
import emailNotificationService from "../services/email-notification.service.js";
import { emitNewAlert, emitVitalsUpdate } from "./events.js";

export function setupSocket(io: SocketServer): void {
  io.on("connection", (socket: Socket) => {
    console.log(`[Socket] Client connected: ${socket.id}`);

    socket.on("join:patient", (patientId: string) => {
      socket.join(`patient:${patientId}`);
      console.log(`[Socket] ${socket.id} joined room patient:${patientId}`);
    });

    socket.on("join:doctor", () => {
      socket.join("doctors");
      console.log(`[Socket] ${socket.id} joined doctors room`);
    });

    socket.on("join:caregiver", () => {
      socket.join("caregivers");
      console.log(`[Socket] ${socket.id} joined caregivers room`);
    });

    socket.on("vitals:push", async (data: VitalReading) => {
      try {
        const result = await IngestionService.ingest(data);
        if (!result.valid) {
          socket.emit("vitals:error", { issues: result.issues });
          return;
        }

        const assessment = await RiskService.evaluate(data.patient_id, data);
        const alert = await AlertService.processRiskAssessment(assessment);
        await BaselineService.updateBaseline(data.patient_id, [data]);
        const healthScore = HealthScoreService.calculate(
          assessment.risk_score,
          data.activity_level,
          assessment.risk_level,
        );
        await HealthScoreService.save(data.patient_id, healthScore);
        await emailNotificationService.sendCriticalDoctorAlert({
          patientId: data.patient_id,
          assessment,
          healthScore,
          reading: data,
        });

        emitVitalsUpdate({
          patientId: data.patient_id,
          reading: result.record,
          risk: assessment,
          healthScore,
        });

        if (alert) {
          emitNewAlert(alert);
        }
      } catch (error) {
        console.error("[Socket] vitals:push error:", error);
        socket.emit("vitals:error", { error: "Processing failed" });
      }
    });

    socket.on("disconnect", () => {
      console.log(`[Socket] Client disconnected: ${socket.id}`);
    });
  });
}

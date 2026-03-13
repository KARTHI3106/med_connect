import { Router, Request, Response } from "express";
import { authenticate, authorizeRoles } from "../middleware/auth.middleware.js";
import { AlertService } from "../services/alert.service.js";
import { getPool, inMemoryDb } from "../config/database.js";
import { IngestionService } from "../services/ingestion.service.js";
import { RiskService } from "../services/risk.service.js";
import { BaselineService } from "../services/baseline.service.js";
import blockchainService from "../services/blockchain.service.js";
import aiAgentService from "../services/ai-agent.service.js";
import { v4 as uuidv4 } from "uuid";
import {
  emitAlertUpdated,
  emitAutoPrescriptionCreated,
} from "../realtime/events.js";

const router = Router();
router.use(authenticate);

interface PatientContext {
  patientId: string;
  patientUserId: string;
  allergies: string[];
  chronicConditions: string[];
}

function parseJsonArray(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.map((v) => String(v));
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.map((v) => String(v)) : [];
    } catch {
      return [];
    }
  }
  return [];
}

async function resolveDoctorIdForPrescription(
  userId: string,
  pool: any,
): Promise<string | null> {
  if (pool) {
    const [doctorRows] = (await pool.execute(
      "SELECT id FROM doctors WHERE id = ? OR user_id = ? LIMIT 1",
      [userId, userId],
    )) as any;
    if (doctorRows.length > 0) return doctorRows[0].id;

    const [fallbackRows] = (await pool.execute(
      "SELECT id FROM doctors ORDER BY id ASC LIMIT 1",
    )) as any;
    return fallbackRows.length > 0 ? fallbackRows[0].id : null;
  }

  const directDoctor = inMemoryDb.doctors.get(userId);
  if (directDoctor) return directDoctor.id;

  const byUser = Array.from(inMemoryDb.doctors.values()).find(
    (d: any) => d.user_id === userId,
  ) as any;
  if (byUser) return byUser.id;

  const fallback = Array.from(inMemoryDb.doctors.values())[0] as any;
  return fallback?.id || null;
}

async function resolvePatientContext(
  alertPatientId: string,
  pool: any,
): Promise<PatientContext> {
  if (pool) {
    const [rows] = (await pool.execute(
      `SELECT id, user_id, allergies, chronic_conditions
       FROM patients
       WHERE id = ? OR user_id = ?
       LIMIT 1`,
      [alertPatientId, alertPatientId],
    )) as any;

    if (rows.length > 0) {
      const row = rows[0];
      return {
        patientId: row.id,
        patientUserId: row.user_id || row.id,
        allergies: parseJsonArray(row.allergies),
        chronicConditions: parseJsonArray(row.chronic_conditions),
      };
    }
  } else {
    const patient =
      (inMemoryDb.patients.get(alertPatientId) as any) ||
      (Array.from(inMemoryDb.patients.values()).find(
        (p: any) => p.user_id === alertPatientId,
      ) as any);

    if (patient) {
      return {
        patientId: patient.id,
        patientUserId: patient.user_id || patient.id,
        allergies: parseJsonArray(patient.allergies),
        chronicConditions: parseJsonArray(patient.chronic_conditions),
      };
    }
  }

  return {
    patientId: alertPatientId,
    patientUserId: alertPatientId,
    allergies: [],
    chronicConditions: [],
  };
}

router.get("/", async (req: Request, res: Response) => {
  try {
    const { role, userId } = req.user!;
    let alerts;
    if (role === "doctor" || role === "caregiver") {
      alerts = await AlertService.getAllActiveAlerts();
    } else {
      alerts = await AlertService.getAlertsForPatient(userId);
    }
    return res.json({ success: true, data: alerts });
  } catch (error: any) {
    return res
      .status(500)
      .json({ success: false, error: "Failed to fetch alerts" });
  }
});

router.get("/patient/:patientId", async (req: Request, res: Response) => {
  try {
    const alerts = await AlertService.getAlertsForPatient(req.params.patientId);
    return res.json({ success: true, data: alerts });
  } catch (error: any) {
    return res
      .status(500)
      .json({ success: false, error: "Failed to fetch patient alerts" });
  }
});

router.post("/:alertId/acknowledge", async (req: Request, res: Response) => {
  try {
    const alert = await AlertService.acknowledgeAlert(
      req.params.alertId,
      req.user!.userId,
    );
    if (!alert) {
      return res.status(404).json({ success: false, error: "Alert not found" });
    }
    emitAlertUpdated(alert);
    return res.json({
      success: true,
      message: "Alert acknowledged",
      data: alert,
    });
  } catch (error: any) {
    return res
      .status(500)
      .json({ success: false, error: "Failed to acknowledge alert" });
  }
});

router.post(
  "/:alertId/resolve",
  authorizeRoles("doctor", "caregiver"),
  async (req: Request, res: Response) => {
    try {
      const alert = await AlertService.resolveAlert(req.params.alertId);
      if (!alert) {
        return res
          .status(404)
          .json({ success: false, error: "Alert not found" });
      }

      emitAlertUpdated(alert);

      const pool = getPool();
      const doctorId = await resolveDoctorIdForPrescription(
        req.user!.userId,
        pool,
      );
      let prescription: any = null;

      if (doctorId) {
        try {
          const patientContext = await resolvePatientContext(
            alert.patient_id,
            pool,
          );
          const latestRisk = await RiskService.getLatestAssessment(
            alert.patient_id,
          );
          const recentReadings = IngestionService.getRecentReadings(
            alert.patient_id,
          );
          const latestReading =
            recentReadings.length > 0
              ? recentReadings[recentReadings.length - 1]
              : null;
          const baseline = await BaselineService.getBaseline(alert.patient_id);

          const aiRecommendation =
            await aiAgentService.generateAlertPrescription({
              alertLevel: alert.alert_level,
              alertMessage: alert.message,
              riskAssessment: latestRisk,
              currentVitals: latestReading,
              baseline,
              patientAllergies: patientContext.allergies,
              chronicConditions: patientContext.chronicConditions,
            });

          const prescriptionId = uuidv4();
          const prescriptionDate = new Date();
          const validUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
          const blockchainHash = blockchainService.generatePrescriptionHash({
            patientId: patientContext.patientId,
            doctorId,
            diagnosis: aiRecommendation.diagnosis,
            medicines: aiRecommendation.medicines,
            timestamp: Date.now(),
          });
          const txResult =
            await blockchainService.recordPrescription(blockchainHash);

          if (pool) {
            await pool.execute(
              `INSERT INTO prescriptions
                (id, patient_id, doctor_id, diagnosis, medicines, prescription_hash, blockchain_hash, prescription_date, valid_until, notes)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                prescriptionId,
                patientContext.patientId,
                doctorId,
                aiRecommendation.diagnosis,
                JSON.stringify(aiRecommendation.medicines),
                blockchainHash,
                txResult.txHash || blockchainHash,
                prescriptionDate,
                validUntil,
                aiRecommendation.notes,
              ],
            );
          } else {
            inMemoryDb.prescriptions.set(prescriptionId, {
              id: prescriptionId,
              patient_id: patientContext.patientId,
              doctor_id: doctorId,
              diagnosis: aiRecommendation.diagnosis,
              medicines: JSON.stringify(aiRecommendation.medicines),
              prescription_hash: blockchainHash,
              blockchain_hash: txResult.txHash || blockchainHash,
              status: "active",
              prescription_date: prescriptionDate.toISOString(),
              valid_until: validUntil.toISOString(),
              notes: aiRecommendation.notes,
              created_at: new Date().toISOString(),
            });
          }

          prescription = {
            id: prescriptionId,
            diagnosis: aiRecommendation.diagnosis,
            medicines: aiRecommendation.medicines,
            notes: aiRecommendation.notes,
            blockchainHash: txResult.txHash || blockchainHash,
            prescriptionHash: blockchainHash,
            aiPowered: aiRecommendation.aiPowered,
            patientId: patientContext.patientUserId,
            createdAt: prescriptionDate.toISOString(),
          };

          emitAutoPrescriptionCreated({
            alertId: alert.id,
            patientId: alert.patient_id,
            prescription: {
              id: prescription.id,
              diagnosis: prescription.diagnosis,
              medicines: prescription.medicines,
              blockchainHash: prescription.blockchainHash,
              createdAt: prescription.createdAt,
              aiPowered: prescription.aiPowered,
            },
          });
        } catch (autoPrescriptionError) {
          console.error(
            "Auto prescription generation failed for resolved alert:",
            autoPrescriptionError,
          );
        }
      }

      return res.json({
        success: true,
        message: "Alert resolved",
        data: {
          alert,
          prescription,
        },
      });
    } catch (error: any) {
      return res
        .status(500)
        .json({ success: false, error: "Failed to resolve alert" });
    }
  },
);

export default router;

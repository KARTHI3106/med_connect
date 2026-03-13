import { Router, Request, Response } from "express";
import { authenticate, authorizeRoles } from "../middleware/auth.middleware.js";
import {
  IngestionService,
  VitalReading,
} from "../services/ingestion.service.js";
import { RiskService } from "../services/risk.service.js";
import { AlertService } from "../services/alert.service.js";
import { BaselineService } from "../services/baseline.service.js";
import { HealthScoreService } from "../services/health-score.service.js";
import emailNotificationService from "../services/email-notification.service.js";
import { emitNewAlert, emitVitalsUpdate } from "../realtime/events.js";

const router = Router();

router.post("/batch", async (req: Request, res: Response) => {
  try {
    const { patient_id, readings } = req.body;
    if (!patient_id || !Array.isArray(readings) || readings.length === 0) {
      return res.status(400).json({
        success: false,
        error: "patient_id and readings array required",
      });
    }

    const results = [] as any[];
    for (const r of readings) {
      const reading: VitalReading = { patient_id, ...r };
      const ingestResult = await IngestionService.ingest(reading);
      if (ingestResult.valid) {
        const assessment = await RiskService.evaluate(patient_id, reading);
        const alert = await AlertService.processRiskAssessment(assessment);
        await BaselineService.updateBaseline(patient_id, [reading]);
        const healthScore = HealthScoreService.calculate(
          assessment.risk_score,
          reading.activity_level || "resting",
          assessment.risk_level,
        );
        await HealthScoreService.save(patient_id, healthScore);
        await emailNotificationService.sendCriticalDoctorAlert({
          patientId: patient_id,
          assessment,
          healthScore,
          reading,
        });
        emitVitalsUpdate({
          patientId: patient_id,
          reading: ingestResult.record,
          risk: assessment,
          healthScore,
        });
        if (alert) {
          emitNewAlert(alert);
        }
        results.push({
          valid: true,
          risk: assessment,
          alert: alert || undefined,
          health_score: healthScore,
        });
      } else {
        results.push({ valid: false, issues: ingestResult.issues });
      }
    }

    return res.json({
      success: true,
      data: { processed: results.length, results },
    });
  } catch (error: any) {
    console.error("Batch vitals error:", error);
    return res
      .status(500)
      .json({ success: false, error: "Batch processing failed" });
  }
});

router.use(authenticate);

router.post(
  "/",
  authorizeRoles("patient"),
  async (req: Request, res: Response) => {
    try {
      const userId = req.user!.userId;
      const reading: VitalReading = {
        patient_id: userId,
        heart_rate: req.body.heart_rate,
        spo2: req.body.spo2,
        systolic_bp: req.body.systolic_bp,
        diastolic_bp: req.body.diastolic_bp,
        temperature: req.body.temperature,
        activity_level: req.body.activity_level || "resting",
        device_id: req.body.device_id,
      };

      const ingestResult = await IngestionService.ingest(reading);
      if (!ingestResult.valid) {
        return res.status(400).json({
          success: false,
          error: "Invalid vitals data",
          issues: ingestResult.issues,
        });
      }

      const assessment = await RiskService.evaluate(userId, reading);
      const alert = await AlertService.processRiskAssessment(assessment);
      await BaselineService.updateBaseline(userId, [reading]);
      const healthScore = HealthScoreService.calculate(
        assessment.risk_score,
        reading.activity_level,
        assessment.risk_level,
      );
      await HealthScoreService.save(userId, healthScore);
      await emailNotificationService.sendCriticalDoctorAlert({
        patientId: userId,
        assessment,
        healthScore,
        reading,
      });
      emitVitalsUpdate({
        patientId: userId,
        reading: ingestResult.record,
        risk: assessment,
        healthScore,
      });
      if (alert) {
        emitNewAlert(alert);
      }

      return res.json({
        success: true,
        data: {
          reading_id: ingestResult.id,
          reading: ingestResult.record,
          risk: assessment,
          alert: alert || undefined,
          health_score: healthScore,
        },
      });
    } catch (error: any) {
      console.error("Vitals ingest error:", error);
      return res
        .status(500)
        .json({ success: false, error: "Failed to process vitals" });
    }
  },
);

router.get("/recent/:patientId", async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const readings = IngestionService.getRecentReadings(patientId);
    return res.json({ success: true, data: readings });
  } catch (error: any) {
    return res
      .status(500)
      .json({ success: false, error: "Failed to fetch readings" });
  }
});

export default router;

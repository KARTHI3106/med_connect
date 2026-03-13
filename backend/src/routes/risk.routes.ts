import { Router, Request, Response } from "express";
import { authenticate } from "../middleware/auth.middleware.js";
import { RiskService } from "../services/risk.service.js";
import { BaselineService } from "../services/baseline.service.js";
import { IngestionService } from "../services/ingestion.service.js";
import { aiAgentService } from "../services/ai-agent.service.js";

const router = Router();
router.use(authenticate);

router.get("/:patientId", async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const assessment = await RiskService.getLatestAssessment(patientId);
    if (!assessment) {
      return res.json({
        success: true,
        data: null,
        message: "No risk assessment yet",
      });
    }
    return res.json({ success: true, data: assessment });
  } catch (error: any) {
    return res
      .status(500)
      .json({ success: false, error: "Failed to fetch risk assessment" });
  }
});

router.get("/:patientId/explain", async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const assessment = await RiskService.getLatestAssessment(patientId);
    if (!assessment) {
      return res.json({
        success: true,
        data: null,
        message: "No risk assessment to explain",
      });
    }

    const recent = IngestionService.getRecentReadings(patientId);
    const baseline = await BaselineService.getBaseline(patientId);
    const latestReading = recent.length > 0 ? recent[recent.length - 1] : null;

    if (!latestReading) {
      return res.json({
        success: true,
        data: null,
        message: "No vitals data available",
      });
    }

    const explanation = await aiAgentService.explainRisk(
      assessment,
      latestReading,
      baseline,
    );
    return res.json({ success: true, data: { assessment, explanation } });
  } catch (error: any) {
    console.error("Risk explanation error:", error);
    return res
      .status(500)
      .json({ success: false, error: "Failed to generate risk explanation" });
  }
});

export default router;

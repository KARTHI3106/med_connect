import { Router, Request, Response } from "express";
import { authenticate, authorizeRoles } from "../middleware/auth.middleware.js";
import { buildMonitoringSummary } from "../agents/monitoring-summary.orchestrator.js";

const router = Router();

router.use(authenticate, authorizeRoles("doctor", "caregiver"));

router.get("/summary/:patientId", async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const summary = await buildMonitoringSummary(patientId);
    return res.json({ success: true, data: summary });
  } catch (error: any) {
    console.error("Monitoring summary error:", error);
    return res
      .status(500)
      .json({ success: false, error: "Failed to build monitoring summary" });
  }
});

export default router;

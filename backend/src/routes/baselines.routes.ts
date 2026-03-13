import { Router, Request, Response } from "express";
import { authenticate } from "../middleware/auth.middleware.js";
import { BaselineService } from "../services/baseline.service.js";

const router = Router();
router.use(authenticate);

router.get("/:patientId", async (req: Request, res: Response) => {
  try {
    const baseline = await BaselineService.getBaseline(req.params.patientId);
    return res.json({ success: true, data: baseline });
  } catch (error: any) {
    return res
      .status(500)
      .json({ success: false, error: "Failed to fetch baseline" });
  }
});

export default router;

import { Router, Request, Response } from "express";
import { authenticate, authorizeRoles } from "../middleware/auth.middleware.js";
import { getPool, inMemoryDb } from "../config/database.js";
import { HealthScoreService } from "../services/health-score.service.js";

const router = Router();
router.use(authenticate);

router.get(
  "/",
  authorizeRoles("doctor", "caregiver"),
  async (req: Request, res: Response) => {
    try {
      const pool = getPool();

      if (pool) {
        const [rows] = (await pool.execute(
          `SELECT
             p.id AS patient_id,
             p.user_id,
             p.full_name,
             p.blood_group,
             p.chronic_conditions,
             u.name,
             u.phone
           FROM patients p
           LEFT JOIN users u ON u.id = p.user_id`,
        )) as any;

        const patients = rows.map((p: any) => ({
          id: p.user_id,
          name: p.name || p.full_name || "Unknown",
          phone: p.phone || "",
          blood_group: p.blood_group,
          chronic_conditions: p.chronic_conditions,
        }));

        return res.json({ success: true, data: patients });
      }

      const patients = Array.from(inMemoryDb.patients.values()).map(
        (p: any) => {
          const user = inMemoryDb.users.get(p.user_id);
          return {
            id: p.user_id,
            name: user?.name || p.full_name || "Unknown",
            phone: user?.phone || "",
            blood_group: p.blood_group,
            chronic_conditions: p.chronic_conditions,
          };
        },
      );
      return res.json({ success: true, data: patients });
    } catch (error: any) {
      return res
        .status(500)
        .json({ success: false, error: "Failed to fetch patients" });
    }
  },
);

router.get("/:patientId", async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const pool = getPool();

    if (pool) {
      const [rows] = (await pool.execute(
        `SELECT
           p.id AS patient_id,
           p.user_id,
           p.full_name,
           p.blood_group,
           p.chronic_conditions,
           u.name,
           u.phone
         FROM patients p
         LEFT JOIN users u ON u.id = p.user_id
         WHERE p.user_id = ? OR p.id = ?
         LIMIT 1`,
        [patientId, patientId],
      )) as any;

      if (!rows.length) {
        return res
          .status(404)
          .json({ success: false, error: "Patient not found" });
      }

      const patientRow = rows[0];
      const patient = {
        id: patientRow.user_id,
        name: patientRow.name || patientRow.full_name || "Unknown",
        phone: patientRow.phone || "",
        blood_group: patientRow.blood_group,
        chronic_conditions: patientRow.chronic_conditions,
      };

      const healthScore = await HealthScoreService.getLatest(patientRow.user_id);

      return res.json({
        success: true,
        data: { patient, health_score: healthScore },
      });
    }

    const patientRecord = Array.from(inMemoryDb.patients.values()).find(
      (p: any) => p.user_id === patientId || p.id === patientId,
    );

    if (!patientRecord) {
      return res
        .status(404)
        .json({ success: false, error: "Patient not found" });
    }

    const user = inMemoryDb.users.get(patientRecord.user_id);
    const patient = {
      id: patientRecord.user_id,
      name: user?.name || patientRecord.full_name || "Unknown",
      phone: user?.phone || "",
      blood_group: patientRecord.blood_group,
      chronic_conditions: patientRecord.chronic_conditions,
    };

    const healthScore = await HealthScoreService.getLatest(
      patientRecord.user_id,
    );

    return res.json({
      success: true,
      data: { patient, health_score: healthScore },
    });
  } catch (error: any) {
    return res
      .status(500)
      .json({ success: false, error: "Failed to fetch patient" });
  }
});

export default router;

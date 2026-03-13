import nodemailer from "nodemailer";
import { getPool, inMemoryDb } from "../config/database.js";
import type { RiskAssessment } from "./risk.service.js";
import type { HealthScore } from "./health-score.service.js";
import type { VitalReading } from "./ingestion.service.js";

interface DoctorRecipient {
  email: string;
  name: string;
}

interface CriticalAlertEmailInput {
  patientId: string;
  assessment: RiskAssessment;
  healthScore: HealthScore;
  reading: VitalReading;
}

interface PatientContext {
  patientUserId: string;
  patientEmail: string | null;
}

class EmailNotificationService {
  private readonly transporter: nodemailer.Transporter | null;
  private readonly fromAddress: string;
  private readonly fallbackRecipients: string[];
  private readonly cooldownMs: number;
  private readonly lastSentByPatient = new Map<string, number>();

  constructor() {
    const host = process.env.SMTP_HOST;
    const port = Number(process.env.SMTP_PORT || 587);
    const secure = String(process.env.SMTP_SECURE || "false") === "true";
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    this.fromAddress = process.env.SMTP_FROM || user || "";
    this.fallbackRecipients = String(
      `${process.env.DOCTOR_ALERT_EMAILS || ""},${process.env.ALERT_EMAIL || ""}`,
    )
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);

    const cooldownMinutes = Number(
      process.env.ALERT_EMAIL_COOLDOWN_MINUTES || 15,
    );
    this.cooldownMs = Math.max(1, cooldownMinutes) * 60 * 1000;

    if (!host || !user || !pass || !this.fromAddress) {
      this.transporter = null;
      console.warn(
        "[Email] SMTP not fully configured. Critical doctor email alerts are disabled.",
      );
      return;
    }

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: {
        user,
        pass,
      },
    });
  }

  async sendCriticalDoctorAlert(input: CriticalAlertEmailInput): Promise<void> {
    if (!this.transporter) return;
    if (input.assessment.risk_level !== "CRITICAL") return;
    if (input.healthScore.score >= 40) return;

    const now = Date.now();
    const lastSentAt = this.lastSentByPatient.get(input.patientId);
    if (lastSentAt && now - lastSentAt < this.cooldownMs) {
      return;
    }

    const patientContext = await this.resolvePatientContext(input.patientId);
    const recipients = await this.resolveDoctorRecipients(input.patientId);
    const recipientEmails = recipients.map((r) => r.email);
    const uniqueRecipients = [
      ...new Set([...recipientEmails, ...this.fallbackRecipients]),
    ];

    if (uniqueRecipients.length === 0) {
      console.warn(
        `[Email] No doctor email recipients found for patient ${input.patientId}`,
      );
      return;
    }

    const subject = `CRITICAL ALERT: Patient ${input.patientId} health score ${input.healthScore.score}`;
    const text = [
      "Critical patient condition detected.",
      `Patient: ${input.patientId}`,
      patientContext.patientEmail
        ? `Patient Email: ${patientContext.patientEmail}`
        : "Patient Email: not provided",
      `Risk Level: ${input.assessment.risk_level}`,
      `Risk Score: ${input.assessment.risk_score}`,
      `Health Score: ${input.healthScore.score}`,
      `Reason: ${input.assessment.reason}`,
      "",
      "Latest vitals:",
      `- Heart Rate: ${input.reading.heart_rate} bpm`,
      `- SpO2: ${input.reading.spo2}%`,
      `- Blood Pressure: ${input.reading.systolic_bp}/${input.reading.diastolic_bp} mmHg`,
      `- Temperature: ${input.reading.temperature} C`,
      "",
      "Immediate clinical review is recommended.",
    ].join("\n");

    const html = `
      <h2>Critical Patient Alert</h2>
      <p><strong>Patient:</strong> ${input.patientId}</p>
      <p><strong>Patient Email:</strong> ${patientContext.patientEmail || "not provided"}</p>
      <p><strong>Risk Level:</strong> ${input.assessment.risk_level}</p>
      <p><strong>Risk Score:</strong> ${input.assessment.risk_score}</p>
      <p><strong>Health Score:</strong> ${input.healthScore.score}</p>
      <p><strong>Reason:</strong> ${input.assessment.reason}</p>
      <h3>Latest Vitals</h3>
      <ul>
        <li>Heart Rate: ${input.reading.heart_rate} bpm</li>
        <li>SpO2: ${input.reading.spo2}%</li>
        <li>Blood Pressure: ${input.reading.systolic_bp}/${input.reading.diastolic_bp} mmHg</li>
        <li>Temperature: ${input.reading.temperature} C</li>
      </ul>
      <p><strong>Action:</strong> Immediate clinical review is recommended.</p>
    `;

    try {
      await this.transporter.sendMail({
        from: this.fromAddress,
        to: uniqueRecipients.join(","),
        replyTo: patientContext.patientEmail || undefined,
        subject,
        text,
        html,
      });
      this.lastSentByPatient.set(input.patientId, now);
      console.log(
        `[Email] Critical alert sent for patient ${input.patientId} to ${uniqueRecipients.length} recipient(s).`,
      );
    } catch (error) {
      console.error("[Email] Failed to send critical doctor alert:", error);
    }
  }

  private async resolveDoctorRecipients(
    patientId: string,
  ): Promise<DoctorRecipient[]> {
    const pool = getPool();

    if (pool) {
      try {
        const [rows] = (await pool.execute(
          `SELECT DISTINCT u.email AS email, d.full_name AS doctor_name
           FROM consents c
           JOIN patients p ON p.id = c.patient_id
           JOIN doctors d ON d.id = c.granted_to_id
           JOIN users u ON u.id = d.user_id
           WHERE (c.patient_id = ? OR p.user_id = ?)
             AND c.granted_to_type = 'doctor'
             AND c.is_active = TRUE
             AND c.expires_at > NOW()
             AND u.email IS NOT NULL
             AND u.email <> ''`,
          [patientId, patientId],
        )) as any;

        return rows.map((row: any) => ({
          email: row.email,
          name: row.doctor_name || "Doctor",
        }));
      } catch (error) {
        console.error(
          "[Email] Failed to fetch doctor recipients from DB:",
          error,
        );
      }
    }

    const patientRecord =
      (inMemoryDb.patients.get(patientId) as any) ||
      (Array.from(inMemoryDb.patients.values()).find(
        (p: any) => p.user_id === patientId,
      ) as any);

    const targetPatientId = patientRecord?.id || patientId;

    const activeDoctorConsents = Array.from(
      inMemoryDb.consents.values(),
    ).filter(
      (consent: any) =>
        consent.patient_id === targetPatientId &&
        consent.granted_to_type === "doctor" &&
        consent.is_active &&
        new Date(consent.expires_at) > new Date(),
    ) as any[];

    const recipients = activeDoctorConsents
      .map((consent) => {
        const doctor = inMemoryDb.doctors.get(consent.granted_to_id) as any;
        if (!doctor) return null;
        const user = inMemoryDb.users.get(doctor.user_id) as any;
        const email = (user?.email || "").trim();
        if (!email) return null;
        return {
          email,
          name: doctor.full_name || user?.name || "Doctor",
        } as DoctorRecipient;
      })
      .filter((value): value is DoctorRecipient => value !== null);

    return [...new Map(recipients.map((r) => [r.email, r])).values()];
  }

  private async resolvePatientContext(
    patientId: string,
  ): Promise<PatientContext> {
    const pool = getPool();

    if (pool) {
      try {
        const [rows] = (await pool.execute(
          `SELECT p.user_id AS user_id, u.email AS email
           FROM patients p
           LEFT JOIN users u ON u.id = p.user_id
           WHERE p.id = ? OR p.user_id = ?
           LIMIT 1`,
          [patientId, patientId],
        )) as any;

        if (rows.length > 0) {
          return {
            patientUserId: rows[0].user_id || patientId,
            patientEmail: rows[0].email ? String(rows[0].email) : null,
          };
        }
      } catch (error) {
        console.error(
          "[Email] Failed to resolve patient email context:",
          error,
        );
      }
    }

    const patientRecord =
      (inMemoryDb.patients.get(patientId) as any) ||
      (Array.from(inMemoryDb.patients.values()).find(
        (p: any) => p.user_id === patientId,
      ) as any);

    const patientUserId = patientRecord?.user_id || patientId;
    const user = inMemoryDb.users.get(patientUserId) as any;

    return {
      patientUserId,
      patientEmail: user?.email ? String(user.email) : null,
    };
  }
}

export const emailNotificationService = new EmailNotificationService();
export default emailNotificationService;

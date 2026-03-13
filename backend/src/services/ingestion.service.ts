import { randomUUID } from "node:crypto";
import { inMemoryDb } from "../config/database.js";

export interface VitalReading {
  patient_id: string;
  heart_rate: number;
  spo2: number;
  systolic_bp: number;
  diastolic_bp: number;
  temperature: number;
  activity_level: string;
  device_id?: string;
}

export interface StoredVitalReading extends VitalReading {
  id: string;
  recorded_at: string;
}

const recentReadings = new Map<string, StoredVitalReading[]>();
const WINDOW_SIZE = 30;

export class IngestionService {
  static async ingest(
    reading: VitalReading,
  ): Promise<{
    id: string;
    valid: boolean;
    issues: string[];
    record: StoredVitalReading;
  }> {
    const issues = this.validateReading(reading);
    const id = randomUUID();

    const record: StoredVitalReading = {
      id,
      ...reading,
      recorded_at: new Date().toISOString(),
    };

    inMemoryDb.vitalReadings.set(id, record);

    const window = recentReadings.get(reading.patient_id) || [];
    window.push(record);
    if (window.length > WINDOW_SIZE) {
      window.shift();
    }
    recentReadings.set(reading.patient_id, window);

    return { id, valid: issues.length === 0, issues, record };
  }

  static getRecentReadings(patientId: string): StoredVitalReading[] {
    return recentReadings.get(patientId) || [];
  }

  static async getReadingsForPatient(
    patientId: string,
    limit: number = 60,
  ): Promise<StoredVitalReading[]> {
    const all = Array.from(inMemoryDb.vitalReadings.values())
      .filter((r: StoredVitalReading) => r.patient_id === patientId)
      .sort(
        (a: StoredVitalReading, b: StoredVitalReading) =>
          new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime(),
      );

    return all.slice(0, limit);
  }

  private static validateReading(r: VitalReading): string[] {
    const issues: string[] = [];
    if (r.heart_rate < 20 || r.heart_rate > 260)
      issues.push("heart_rate out of physiological range");
    if (r.spo2 < 50 || r.spo2 > 100) issues.push("spo2 out of range");
    if (r.temperature < 30 || r.temperature > 45)
      issues.push("temperature out of range");
    if (r.systolic_bp < 60 || r.systolic_bp > 260)
      issues.push("systolic_bp out of range");
    if (r.diastolic_bp < 30 || r.diastolic_bp > 180)
      issues.push("diastolic_bp out of range");
    return issues;
  }
}

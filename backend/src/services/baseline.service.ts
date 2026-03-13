import { randomUUID } from "node:crypto";
import { inMemoryDb } from "../config/database.js";

export interface Baseline {
  heart_rate: number;
  spo2: number;
  systolic_bp: number;
  diastolic_bp: number;
  temperature: number;
  samples_count: number;
}

export class BaselineService {
  static async getBaseline(patientId: string): Promise<Baseline | null> {
    for (const b of inMemoryDb.baselines.values()) {
      if (b.patient_id === patientId) return b;
    }
    return null;
  }

  static async updateBaseline(
    patientId: string,
    readings: any[],
  ): Promise<Baseline> {
    if (readings.length === 0) {
      const existing = await this.getBaseline(patientId);
      if (existing) return existing;
      return {
        heart_rate: 72,
        spo2: 98,
        systolic_bp: 120,
        diastolic_bp: 78,
        temperature: 36.6,
        samples_count: 0,
      };
    }

    const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;

    const incomingBaseline: Baseline = {
      heart_rate: avg(readings.map((r) => r.heart_rate)),
      spo2: avg(readings.map((r) => r.spo2)),
      systolic_bp: avg(readings.map((r) => r.systolic_bp)),
      diastolic_bp: avg(readings.map((r) => r.diastolic_bp)),
      temperature: avg(readings.map((r) => r.temperature)),
      samples_count: readings.length,
    };

    const existing = await this.getBaseline(patientId);

    const baseline: Baseline =
      existing && existing.samples_count > 0
        ? {
            heart_rate:
              (existing.heart_rate * existing.samples_count +
                incomingBaseline.heart_rate * incomingBaseline.samples_count) /
              (existing.samples_count + incomingBaseline.samples_count),
            spo2:
              (existing.spo2 * existing.samples_count +
                incomingBaseline.spo2 * incomingBaseline.samples_count) /
              (existing.samples_count + incomingBaseline.samples_count),
            systolic_bp:
              (existing.systolic_bp * existing.samples_count +
                incomingBaseline.systolic_bp * incomingBaseline.samples_count) /
              (existing.samples_count + incomingBaseline.samples_count),
            diastolic_bp:
              (existing.diastolic_bp * existing.samples_count +
                incomingBaseline.diastolic_bp * incomingBaseline.samples_count) /
              (existing.samples_count + incomingBaseline.samples_count),
            temperature:
              (existing.temperature * existing.samples_count +
                incomingBaseline.temperature * incomingBaseline.samples_count) /
              (existing.samples_count + incomingBaseline.samples_count),
            samples_count: existing.samples_count + incomingBaseline.samples_count,
          }
        : incomingBaseline;

    let found = false;
    for (const [key, b] of inMemoryDb.baselines.entries()) {
      if (b.patient_id === patientId) {
        inMemoryDb.baselines.set(key, {
          ...b,
          ...baseline,
          updated_at: new Date().toISOString(),
        });
        found = true;
        break;
      }
    }
    if (!found) {
      const id = randomUUID();
      inMemoryDb.baselines.set(id, {
        id,
        patient_id: patientId,
        ...baseline,
        updated_at: new Date().toISOString(),
      });
    }

    return baseline;
  }
}

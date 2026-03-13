import { create } from "zustand";
import type {
  VitalReading,
  RiskAssessment,
  HealthScore,
  AlertEvent,
  Baseline,
} from "@/types";
import api from "@/services/api";

interface VitalsState {
  readings: VitalReading[];
  currentRisk: RiskAssessment | null;
  healthScore: HealthScore | null;
  alerts: AlertEvent[];
  baseline: Baseline | null;

  addReading: (reading: VitalReading) => void;
  setRisk: (risk: RiskAssessment) => void;
  setHealthScore: (score: HealthScore) => void;
  addAlert: (alert: AlertEvent) => void;
  updateAlert: (alert: AlertEvent) => void;
  setAlerts: (alerts: AlertEvent[]) => void;
  setBaseline: (baseline: Baseline) => void;

  fetchAlerts: () => Promise<void>;
  fetchBaseline: (patientId: string) => Promise<void>;
  fetchRecentReadings: (patientId: string) => Promise<void>;
  acknowledgeAlert: (alertId: string) => Promise<void>;
}

export const useVitalsStore = create<VitalsState>()((set) => ({
  readings: [],
  currentRisk: null,
  healthScore: null,
  alerts: [],
  baseline: null,

  addReading: (reading) => {
    set((state) => ({
      readings: [...state.readings.slice(-99), reading],
    }));
  },

  setRisk: (risk) => set({ currentRisk: risk }),
  setHealthScore: (score) => set({ healthScore: score }),

  addAlert: (alert) => {
    set((state) => ({
      alerts: state.alerts.some((a) => a.id === alert.id)
        ? state.alerts.map((a) => (a.id === alert.id ? alert : a))
        : [alert, ...state.alerts],
    }));
  },

  updateAlert: (alert) => {
    set((state) => ({
      alerts: state.alerts.some((a) => a.id === alert.id)
        ? state.alerts.map((a) => (a.id === alert.id ? alert : a))
        : [alert, ...state.alerts],
    }));
  },

  setAlerts: (alerts) => set({ alerts }),
  setBaseline: (baseline) => set({ baseline }),

  fetchAlerts: async () => {
    try {
      const { data } = await api.get("/alerts");
      if (data.success) set({ alerts: data.data });
    } catch (error) {
      console.error("Failed to fetch alerts:", error);
    }
  },

  fetchBaseline: async (patientId: string) => {
    try {
      const { data } = await api.get(`/baselines/${patientId}`);
      if (data.success && data.data) set({ baseline: data.data });
    } catch (error) {
      console.error("Failed to fetch baseline:", error);
    }
  },

  fetchRecentReadings: async (patientId: string) => {
    try {
      const { data } = await api.get(`/vitals/recent/${patientId}`);
      if (data.success) set({ readings: data.data });
    } catch (error) {
      console.error("Failed to fetch readings:", error);
    }
  },

  acknowledgeAlert: async (alertId: string) => {
    try {
      await api.post(`/alerts/${alertId}/acknowledge`);
      set((state) => ({
        alerts: state.alerts.map((a) =>
          a.id === alertId
            ? { ...a, acknowledged_at: new Date().toISOString() }
            : a,
        ),
      }));
    } catch (error) {
      console.error("Failed to acknowledge alert:", error);
    }
  },
}));

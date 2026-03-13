import { io, Socket } from "socket.io-client";
import type {
  VitalReading,
  RiskAssessment,
  HealthScore,
  AlertEvent,
} from "@/types";

let socket: Socket | null = null;
const API_BASE_URL = import.meta.env.VITE_API_URL || "/api";

function deriveSocketUrl(): string {
  const explicit = import.meta.env.VITE_SOCKET_URL;
  if (explicit) {
    return explicit;
  }

  const apiUrl = import.meta.env.VITE_API_URL;
  if (apiUrl && /^https?:\/\//i.test(apiUrl)) {
    return apiUrl.replace(/\/api\/?$/, "");
  }

  return import.meta.env.PROD ? window.location.origin : "http://localhost:3001";
}

const SOCKET_URL = deriveSocketUrl();

async function postVitalsFallback(reading: VitalReading): Promise<void> {
  try {
    const { patient_id, ...readingPayload } = reading;
    await fetch(`${API_BASE_URL}/vitals/batch`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        patient_id,
        readings: [readingPayload],
      }),
    });
  } catch (error) {
    console.error("[Vitals] HTTP fallback failed:", error);
  }
}

export function getSocket(): Socket {
  if (!socket) {
    socket = io(SOCKET_URL, {
      transports: ["websocket", "polling"],
      autoConnect: true,
    });
    socket.on("connect_error", (err) => {
      console.error("[Socket] connect_error:", err.message);
    });
  }
  return socket;
}

export function joinPatientRoom(patientId: string): void {
  getSocket().emit("join:patient", patientId);
}

export function joinDoctorRoom(): void {
  getSocket().emit("join:doctor");
}

export function joinCaregiverRoom(): void {
  getSocket().emit("join:caregiver");
}

export function pushVitals(reading: VitalReading): void {
  const s = getSocket();
  if (s.connected) {
    s.emit("vitals:push", reading);
    return;
  }

  // Socket can reconnect later; send via API now to avoid dropped simulator cycles.
  void postVitalsFallback(reading);
}

export interface VitalsUpdate {
  patient_id?: string;
  reading: VitalReading;
  risk: RiskAssessment;
  health_score: HealthScore;
}

export function onVitalsUpdate(cb: (data: VitalsUpdate) => void): () => void {
  const s = getSocket();
  s.on("vitals:update", cb);
  return () => {
    s.off("vitals:update", cb);
  };
}

export function onNewAlert(cb: (alert: AlertEvent) => void): () => void {
  const s = getSocket();
  s.on("alert:new", cb);
  return () => {
    s.off("alert:new", cb);
  };
}

export function onAlertUpdated(cb: (alert: AlertEvent) => void): () => void {
  const s = getSocket();
  s.on("alert:updated", cb);
  return () => {
    s.off("alert:updated", cb);
  };
}

export interface AutoPrescriptionCreatedEvent {
  alertId: string;
  patientId: string;
  prescription: {
    id: string;
    diagnosis: string;
    medicines: Array<{
      name: string;
      dosage?: string;
      frequency?: string;
      duration?: string;
      quantity?: number;
    }>;
    blockchainHash: string;
    createdAt: string;
    aiPowered: boolean;
  };
}

export function onAutoPrescriptionCreated(
  cb: (event: AutoPrescriptionCreatedEvent) => void,
): () => void {
  const s = getSocket();
  s.on("prescription:auto-created", cb);
  return () => {
    s.off("prescription:auto-created", cb);
  };
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

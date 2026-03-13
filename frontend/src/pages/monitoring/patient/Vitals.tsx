import { useEffect } from "react";
import { Heart, Droplets, Thermometer, Activity } from "lucide-react";
import { useAuthStore } from "@/store/auth.store";
import { useVitalsStore } from "@/store/vitals.store";
import { GlassCard, StatCard } from "@/components/shared/GlassCard";
import { VitalChart } from "@/components/shared/VitalChart";

export function PatientMonitoringVitals(): React.ReactElement {
  const { user } = useAuthStore();
  const { readings, baseline, fetchRecentReadings, fetchBaseline } =
    useVitalsStore();
  const patientId = user?.id || "";

  useEffect(() => {
    if (!patientId) return;
    fetchRecentReadings(patientId);
    fetchBaseline(patientId);
  }, [patientId, fetchBaseline, fetchRecentReadings]);

  const latest = readings.length > 0 ? readings[readings.length - 1] : null;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">My Vitals</h1>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Heart Rate"
          value={latest ? `${latest.heart_rate} bpm` : "--"}
          icon={<Heart className="w-6 h-6" />}
          color="text-danger-500"
        />
        <StatCard
          title="SpO2"
          value={latest ? `${latest.spo2}%` : "--"}
          icon={<Droplets className="w-6 h-6" />}
          color="text-primary-400"
        />
        <StatCard
          title="Blood Pressure"
          value={latest ? `${latest.systolic_bp}/${latest.diastolic_bp}` : "--"}
          icon={<Activity className="w-6 h-6" />}
          color="text-warning-500"
        />
        <StatCard
          title="Temperature"
          value={latest ? `${latest.temperature}C` : "--"}
          icon={<Thermometer className="w-6 h-6" />}
          color="text-success-500"
        />
      </div>

      {baseline && (
        <GlassCard>
          <h3 className="text-sm font-medium text-white/60 mb-2">
            Your Personalized Baseline
          </h3>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 text-sm">
            <div>
              <span className="text-white/40">Heart Rate:</span>{" "}
              <span className="text-white">{baseline.heart_rate} bpm</span>
            </div>
            <div>
              <span className="text-white/40">SpO2:</span>{" "}
              <span className="text-white">{baseline.spo2}%</span>
            </div>
            <div>
              <span className="text-white/40">Systolic BP:</span>{" "}
              <span className="text-white">{baseline.systolic_bp} mmHg</span>
            </div>
            <div>
              <span className="text-white/40">Temp:</span>{" "}
              <span className="text-white">{baseline.temperature}C</span>
            </div>
            <div>
              <span className="text-white/40">Samples:</span>{" "}
              <span className="text-white">{baseline.samples_count}</span>
            </div>
          </div>
        </GlassCard>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <VitalChart
          readings={readings}
          baseline={baseline}
          metric="heart_rate"
          title="Heart Rate"
          unit="bpm"
          color="#ef4444"
        />
        <VitalChart
          readings={readings}
          baseline={baseline}
          metric="spo2"
          title="SpO2"
          unit="%"
          color="#3b82f6"
        />
        <VitalChart
          readings={readings}
          baseline={baseline}
          metric="systolic_bp"
          title="Systolic BP"
          unit="mmHg"
          color="#f59e0b"
        />
        <VitalChart
          readings={readings}
          baseline={baseline}
          metric="temperature"
          title="Temperature"
          unit="C"
          color="#10b981"
        />
      </div>
    </div>
  );
}

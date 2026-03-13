import { useEffect, useState } from "react";
import {
  Heart,
  Droplets,
  Thermometer,
  Activity,
  Mail,
  Save,
} from "lucide-react";
import { useAuthStore } from "@/store/auth.store";
import { useVitalsStore } from "@/store/vitals.store";
import { GlassCard, StatCard } from "@/components/shared/GlassCard";
import { HealthScoreRing } from "@/components/shared/HealthScoreRing";
import { RiskBadge } from "@/components/shared/RiskBadge";
import { VitalChart } from "@/components/shared/VitalChart";
import { AlertBanner } from "@/components/shared/AlertBanner";
import { SimulatorPanel } from "@/components/shared/SimulatorPanel";
import { joinPatientRoom, onVitalsUpdate, onNewAlert } from "@/services/socket";
import { Input } from "@/components/shared/Input";
import { Button } from "@/components/shared/Button";
import api, { authApi } from "@/services/api";

function estimateHealthScoreFromRisk(riskScore: number, riskLevel: string): number {
  const normalizedRisk = Math.max(0, Math.min(100, Number.isFinite(riskScore) ? riskScore : 0));

  if (riskLevel === "CRITICAL") {
    return Math.round(Math.max(8, Math.min(39, 74 - normalizedRisk * 0.65)));
  }
  if (riskLevel === "HIGH") {
    return Math.round(Math.max(30, Math.min(69, 86 - normalizedRisk * 0.9)));
  }
  if (riskLevel === "MEDIUM") {
    return Math.round(Math.max(55, Math.min(84, 92 - normalizedRisk * 0.9)));
  }

  return Math.round(Math.max(80, Math.min(100, 100 - normalizedRisk * 0.8 + 6)));
}

export function PatientMonitoringDashboard(): React.ReactElement {
  const { user, setUser } = useAuthStore();
  const {
    readings,
    currentRisk,
    healthScore,
    alerts,
    baseline,
    addReading,
    setRisk,
    setHealthScore,
    addAlert,
    fetchAlerts,
    fetchBaseline,
    fetchRecentReadings,
    acknowledgeAlert,
  } = useVitalsStore();

  const patientId = user?.id || "";
  const [email, setEmail] = useState(user?.email || "");
  const [isSavingEmail, setIsSavingEmail] = useState(false);
  const [emailMessage, setEmailMessage] = useState<string | null>(null);

  useEffect(() => {
    setEmail(user?.email || "");
  }, [user?.email]);

  useEffect(() => {
    if (!patientId) return;

    const refreshHealthScore = async () => {
      try {
        const { data } = await api.get(`/patients/${patientId}`);
        if (data.success && data.data?.health_score) {
          setHealthScore(data.data.health_score);
        }
      } catch {
        // Keep socket-driven state when polling fails.
      }
    };

    joinPatientRoom(patientId);
    fetchAlerts();
    fetchBaseline(patientId);
    fetchRecentReadings(patientId);
    void refreshHealthScore();

    const unsub1 = onVitalsUpdate((data) => {
      addReading(data.reading);
      setRisk(data.risk);
      setHealthScore(data.health_score);
    });
    const unsub2 = onNewAlert((alert) => addAlert(alert));
    const monitoringPolling = setInterval(() => {
      void fetchRecentReadings(patientId);
      void refreshHealthScore();
    }, 15000);

    return () => {
      clearInterval(monitoringPolling);
      unsub1();
      unsub2();
    };
  }, [
    patientId,
    addReading,
    addAlert,
    fetchAlerts,
    fetchBaseline,
    fetchRecentReadings,
    setHealthScore,
    setRisk,
  ]);

  const latest = readings.length > 0 ? readings[readings.length - 1] : null;
  const displayHealthScore =
    healthScore?.score ??
    (currentRisk
      ? estimateHealthScoreFromRisk(currentRisk.risk_score, currentRisk.risk_level)
      : 0);

  const handleSaveEmail = async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setEmailMessage("Please enter an email address.");
      return;
    }

    setIsSavingEmail(true);
    setEmailMessage(null);

    try {
      const result = await authApi.updateEmail(trimmedEmail);
      if (result.success) {
        if (user) {
          setUser({ ...user, email: trimmedEmail });
        }
        setEmailMessage(
          "Email saved. Critical health reports can now be sent.",
        );
      } else {
        setEmailMessage(result.error || "Failed to save email.");
      }
    } catch (error: any) {
      setEmailMessage(error?.response?.data?.error || "Failed to save email.");
    } finally {
      setIsSavingEmail(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">
            Monitoring Dashboard
          </h1>
          <p className="text-white/50">Welcome back, {user?.name}</p>
        </div>
        {currentRisk && <RiskBadge level={currentRisk.risk_level} size="lg" />}
      </div>

      <AlertBanner
        alerts={alerts}
        onAcknowledge={acknowledgeAlert}
        onDismiss={() => {}}
      />

      <GlassCard>
        <div className="flex flex-col md:flex-row md:items-end gap-3">
          <div className="flex-1">
            <Input
              label="Patient Email For Critical Report"
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              leftIcon={<Mail className="w-4 h-4" />}
            />
          </div>
          <Button
            variant="outline"
            leftIcon={<Save className="w-4 h-4" />}
            onClick={handleSaveEmail}
            isLoading={isSavingEmail}
          >
            Save Email
          </Button>
        </div>
        {emailMessage && (
          <p className="text-xs text-white/60 mt-2">{emailMessage}</p>
        )}
      </GlassCard>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <GlassCard className="lg:col-span-1 flex flex-col items-center justify-center py-6">
          <HealthScoreRing score={displayHealthScore} size="md" />
          <p className="text-sm text-white/50 mt-2">Health Score</p>
        </GlassCard>

        <div className="lg:col-span-4 grid grid-cols-2 lg:grid-cols-4 gap-4">
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
            value={
              latest ? `${latest.systolic_bp}/${latest.diastolic_bp}` : "--"
            }
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
      </div>

      <SimulatorPanel patientId={patientId} />

      {currentRisk && (
        <GlassCard>
          <h3 className="text-sm font-medium text-white/60 mb-2">
            Risk Assessment
          </h3>
          <p className="text-white/80">{currentRisk.reason}</p>
          <p className="text-sm text-white/50 mt-2">
            {currentRisk.trend_summary}
          </p>
          <p className="text-sm text-primary-400 mt-2">
            {currentRisk.recommended_action}
          </p>
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

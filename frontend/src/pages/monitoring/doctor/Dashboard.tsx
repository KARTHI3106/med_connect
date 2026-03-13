import { useEffect, useState } from "react";
import { Users, Bell, Activity, AlertTriangle, Mail, Save } from "lucide-react";
import { useAuthStore } from "@/store/auth.store";
import { useVitalsStore } from "@/store/vitals.store";
import { GlassCard, StatCard } from "@/components/shared/GlassCard";
import { AlertBanner } from "@/components/shared/AlertBanner";
import { Input } from "@/components/shared/Input";
import { Button } from "@/components/shared/Button";
import {
  joinDoctorRoom,
  onAlertUpdated,
  onNewAlert,
  onVitalsUpdate,
} from "@/services/socket";
import api, { authApi } from "@/services/api";
import type { MonitoringPatient } from "@/types";

export function DoctorMonitoringDashboard(): React.ReactElement {
  const { user, setUser } = useAuthStore();
  const { alerts, fetchAlerts, acknowledgeAlert, addAlert, updateAlert } =
    useVitalsStore();
  const [patients, setPatients] = useState<MonitoringPatient[]>([]);
  const [email, setEmail] = useState(user?.email || "");
  const [isSavingEmail, setIsSavingEmail] = useState(false);
  const [emailMessage, setEmailMessage] = useState<string | null>(null);

  useEffect(() => {
    setEmail(user?.email || "");
  }, [user?.email]);

  useEffect(() => {
    const loadPatients = async () => {
      try {
        const { data } = await api.get("/patients");
        if (data.success) {
          setPatients(data.data);
        }
      } catch {
        // Keep existing UI state when refresh fails.
      }
    };

    joinDoctorRoom();
    fetchAlerts();
    loadPatients();

    const polling = setInterval(() => {
      loadPatients();
      fetchAlerts();
    }, 10000);

    const unsub = onNewAlert((alert) => addAlert(alert));
    const unsubUpdated = onAlertUpdated((alert) => updateAlert(alert));
    const unsubVitals = onVitalsUpdate(() => {
      void loadPatients();
    });

    return () => {
      clearInterval(polling);
      unsub();
      unsubUpdated();
      unsubVitals();
    };
  }, [addAlert, fetchAlerts, updateAlert]);

  const activeAlerts = alerts.filter((a) => !a.resolved);
  const criticalCount = activeAlerts.filter(
    (a) => a.alert_level === "CRITICAL",
  ).length;

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
        setEmailMessage("Doctor alert email saved successfully.");
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
      <div>
        <h1 className="text-2xl font-bold text-white">Monitoring Dashboard</h1>
        <p className="text-white/50">Welcome, {user?.name}</p>
      </div>

      <AlertBanner
        alerts={alerts}
        onAcknowledge={acknowledgeAlert}
        onDismiss={() => undefined}
      />

      <GlassCard>
        <div className="flex flex-col md:flex-row md:items-end gap-3">
          <div className="flex-1">
            <Input
              label="Doctor Email For Critical Alerts"
              type="email"
              placeholder="Enter doctor alert email"
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          title="Patients"
          value={patients.length}
          icon={<Users className="w-6 h-6" />}
          color="text-primary-400"
        />
        <StatCard
          title="Active Alerts"
          value={activeAlerts.length}
          icon={<Bell className="w-6 h-6" />}
          color="text-warning-500"
        />
        <StatCard
          title="Critical"
          value={criticalCount}
          icon={<AlertTriangle className="w-6 h-6" />}
          color="text-danger-500"
        />
      </div>

      <GlassCard>
        <h3 className="text-sm font-medium text-white/60 mb-4">Patient List</h3>
        {patients.length === 0 ? (
          <p className="text-white/40 text-center py-8">
            No patients registered yet.
          </p>
        ) : (
          <div className="space-y-2">
            {patients.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between p-3 bg-white/5 rounded-xl"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary-500/20 flex items-center justify-center">
                    <Users className="w-4 h-4 text-primary-400" />
                  </div>
                  <div>
                    <p className="text-white text-sm font-medium">{p.name}</p>
                    <p className="text-xs text-white/40">{p.phone}</p>
                  </div>
                </div>
                <Activity className="w-4 h-4 text-white/30" />
              </div>
            ))}
          </div>
        )}
      </GlassCard>
    </div>
  );
}

import { useEffect, useState } from "react";
import { Users, Bell, AlertTriangle } from "lucide-react";
import { useAuthStore } from "@/store/auth.store";
import { useVitalsStore } from "@/store/vitals.store";
import { GlassCard, StatCard } from "@/components/shared/GlassCard";
import { AlertBanner } from "@/components/shared/AlertBanner";
import { joinCaregiverRoom, onNewAlert } from "@/services/socket";
import api from "@/services/api";
import type { MonitoringPatient } from "@/types";

export function CaregiverMonitoringDashboard(): React.ReactElement {
  const { user } = useAuthStore();
  const { alerts, fetchAlerts, acknowledgeAlert, addAlert } = useVitalsStore();
  const [patients, setPatients] = useState<MonitoringPatient[]>([]);

  useEffect(() => {
    joinCaregiverRoom();
    fetchAlerts();

    api
      .get("/patients")
      .then(({ data }) => {
        if (data.success) setPatients(data.data);
      })
      .catch(() => {});

    const unsub = onNewAlert((alert) => addAlert(alert));
    return () => {
      unsub();
    };
  }, [addAlert, fetchAlerts]);

  const activeAlerts = alerts.filter((a) => !a.resolved);
  const criticalCount = activeAlerts.filter(
    (a) => a.alert_level === "CRITICAL",
  ).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Caregiver Monitoring</h1>
        <p className="text-white/50">Welcome, {user?.name}</p>
      </div>

      <AlertBanner
        alerts={alerts}
        onAcknowledge={acknowledgeAlert}
        onDismiss={() => {}}
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          title="Monitored Patients"
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
        <h3 className="text-sm font-medium text-white/60 mb-4">
          Patients Under Care
        </h3>
        {patients.length === 0 ? (
          <p className="text-white/40 text-center py-8">
            No patients assigned.
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
              </div>
            ))}
          </div>
        )}
      </GlassCard>
    </div>
  );
}

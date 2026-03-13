import { useEffect } from "react";
import { Bell, CheckCircle } from "lucide-react";
import { useVitalsStore } from "@/store/vitals.store";
import { GlassCard } from "@/components/shared/GlassCard";
import { RiskBadge } from "@/components/shared/RiskBadge";

export function PatientMonitoringAlerts(): React.ReactElement {
  const { alerts, fetchAlerts, acknowledgeAlert } = useVitalsStore();

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">My Alerts</h1>

      {alerts.length === 0 ? (
        <GlassCard className="text-center py-12">
          <Bell className="w-12 h-12 text-white/20 mx-auto mb-3" />
          <p className="text-white/50">
            No alerts yet. Your vitals are being monitored.
          </p>
        </GlassCard>
      ) : (
        <div className="space-y-3">
          {alerts.map((alert) => (
            <GlassCard key={alert.id} className="flex items-start gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <RiskBadge level={alert.alert_level} size="sm" />
                  <span className="text-xs text-white/40">
                    {new Date(alert.created_at).toLocaleString()}
                  </span>
                  {alert.acknowledged_at && (
                    <span className="text-xs text-success-500 flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" /> Acknowledged
                    </span>
                  )}
                  {alert.resolved && (
                    <span className="text-xs text-white/40">Resolved</span>
                  )}
                </div>
                <p className="text-sm text-white/80">{alert.message}</p>
                {alert.escalated && (
                  <p className="text-xs text-danger-500 mt-1">
                    Escalated to emergency contacts
                  </p>
                )}
              </div>
              {!alert.acknowledged_at && !alert.resolved && (
                <button
                  onClick={() => acknowledgeAlert(alert.id)}
                  className="px-3 py-1.5 text-xs rounded-lg bg-primary-600 hover:bg-primary-500 text-white transition-colors flex-shrink-0"
                >
                  Acknowledge
                </button>
              )}
            </GlassCard>
          ))}
        </div>
      )}
    </div>
  );
}

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, AlertTriangle, AlertCircle } from "lucide-react";
import type { AlertEvent } from "@/types";
import { RiskBadge } from "./RiskBadge";
import clsx from "clsx";

interface Props {
  alerts: AlertEvent[];
  onAcknowledge: (alertId: string) => void;
  onDismiss?: (alertId: string) => void;
}

export function AlertBanner({
  alerts,
  onAcknowledge,
  onDismiss,
}: Props): React.ReactElement {
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);

  const active = alerts.filter(
    (a) => !a.resolved && !a.acknowledged_at && !dismissedIds.includes(a.id),
  );

  if (active.length === 0) return <></>;

  return (
    <div className="space-y-2 mb-4">
      <AnimatePresence>
        {active.slice(0, 3).map((alert) => (
          <motion.div
            key={alert.id}
            initial={{ opacity: 0, y: -10, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, y: -10, height: 0 }}
            className={clsx(
              "flex items-center gap-3 p-3 rounded-xl border",
              alert.alert_level === "CRITICAL"
                ? "bg-danger-600/10 border-danger-500/30 animate-pulse"
                : alert.alert_level === "HIGH"
                  ? "bg-orange-600/10 border-orange-500/30"
                  : "bg-warning-600/10 border-warning-500/30",
            )}
          >
            {alert.alert_level === "CRITICAL" ? (
              <AlertCircle className="w-5 h-5 text-danger-500 flex-shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-warning-500 flex-shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <RiskBadge level={alert.alert_level} size="sm" />
                <span className="text-xs text-white/40">
                  {new Date(alert.created_at).toLocaleTimeString()}
                </span>
              </div>
              <p className="text-sm text-white/80 truncate">{alert.message}</p>
            </div>
            <button
              onClick={() => onAcknowledge(alert.id)}
              className="px-3 py-1 text-xs rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors flex-shrink-0"
            >
              Acknowledge
            </button>
            <button
              onClick={() => {
                setDismissedIds((prev) =>
                  prev.includes(alert.id) ? prev : [...prev, alert.id],
                );
                onDismiss?.(alert.id);
              }}
              className="text-white/30 hover:text-white/60"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

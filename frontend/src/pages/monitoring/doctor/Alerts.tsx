import { useEffect, useState } from "react";
import { Bell, CheckCircle, Download, FileText } from "lucide-react";
import { useVitalsStore } from "@/store/vitals.store";
import { GlassCard } from "@/components/shared/GlassCard";
import { RiskBadge } from "@/components/shared/RiskBadge";
import api from "@/services/api";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  joinDoctorRoom,
  onAlertUpdated,
  onAutoPrescriptionCreated,
  onNewAlert,
} from "@/services/socket";

interface AutoPrescriptionSummary {
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
  aiPowered: boolean;
}

export function DoctorMonitoringAlerts(): React.ReactElement {
  const { alerts, fetchAlerts, acknowledgeAlert, addAlert, updateAlert } =
    useVitalsStore();
  const [autoPrescriptions, setAutoPrescriptions] = useState<
    Record<string, AutoPrescriptionSummary>
  >({});

  useEffect(() => {
    joinDoctorRoom();
    fetchAlerts();

    const unsubNew = onNewAlert((alert) => addAlert(alert));
    const unsubUpdated = onAlertUpdated((alert) => updateAlert(alert));
    const unsubAutoRx = onAutoPrescriptionCreated((event) => {
      setAutoPrescriptions((prev) => ({
        ...prev,
        [event.alertId]: event.prescription,
      }));
    });

    return () => {
      unsubNew();
      unsubUpdated();
      unsubAutoRx();
    };
  }, [addAlert, fetchAlerts, updateAlert]);

  const handleResolve = async (alertId: string) => {
    try {
      const response = await api.post(`/alerts/${alertId}/resolve`);
      const updatedAlert = response.data?.data?.alert;
      const generatedPrescription = response.data?.data?.prescription;

      if (updatedAlert) {
        updateAlert(updatedAlert);
      } else {
        fetchAlerts();
      }

      if (generatedPrescription) {
        setAutoPrescriptions((prev) => ({
          ...prev,
          [alertId]: {
            id: generatedPrescription.id,
            diagnosis: generatedPrescription.diagnosis,
            medicines: generatedPrescription.medicines || [],
            blockchainHash:
              generatedPrescription.blockchainHash ||
              generatedPrescription.prescriptionHash,
            aiPowered: Boolean(generatedPrescription.aiPowered),
          },
        }));
      }
    } catch (error) {
      console.error("Failed to resolve alert:", error);
    }
  };

  const exportReportAsPdf = () => {
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const reportDate = new Date().toLocaleString();
    const sortedAlerts = [...alerts].sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );

    doc.setFontSize(16);
    doc.text("MedConnect Monitoring Alerts Report", 40, 40);
    doc.setFontSize(10);
    doc.text(`Generated: ${reportDate}`, 40, 58);

    autoTable(doc, {
      startY: 74,
      head: [["Patient", "Level", "Status", "Created At", "Message"]],
      body: sortedAlerts.map((alert) => [
        alert.patient_id,
        alert.alert_level,
        alert.resolved ? "Resolved" : "Active",
        new Date(alert.created_at).toLocaleString(),
        alert.message,
      ]),
      styles: {
        fontSize: 9,
        cellPadding: 5,
      },
      headStyles: {
        fillColor: [22, 96, 190],
      },
      columnStyles: {
        4: { cellWidth: 220 },
      },
    });

    doc.save(
      `monitoring-alerts-report-${new Date().toISOString().slice(0, 10)}.pdf`,
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-white">All Monitoring Alerts</h1>
        <button
          onClick={exportReportAsPdf}
          className="inline-flex items-center gap-2 px-3 py-2 text-xs rounded-lg bg-primary-600 hover:bg-primary-500 text-white"
        >
          <Download className="w-4 h-4" />
          Export PDF
        </button>
      </div>

      {alerts.length === 0 ? (
        <GlassCard className="text-center py-12">
          <Bell className="w-12 h-12 text-white/20 mx-auto mb-3" />
          <p className="text-white/50">No active alerts.</p>
        </GlassCard>
      ) : (
        <div className="space-y-3">
          {alerts.map((alert) => (
            <GlassCard key={alert.id}>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <RiskBadge level={alert.alert_level} size="sm" />
                    <span className="text-xs text-white/40">
                      {new Date(alert.created_at).toLocaleString()}
                    </span>
                    {alert.acknowledged_at && (
                      <span className="text-xs text-success-500 flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" /> Ack
                      </span>
                    )}
                    {alert.resolved && (
                      <span className="text-xs text-white/30">Resolved</span>
                    )}
                  </div>
                  <p className="text-sm text-white/80">{alert.message}</p>
                  <p className="text-xs text-white/40 mt-1">
                    Patient: {alert.patient_id}
                  </p>
                  {autoPrescriptions[alert.id] && (
                    <div className="mt-3 p-3 rounded-lg bg-success-600/10 border border-success-500/30">
                      <div className="flex items-center gap-2 text-success-400 text-xs font-medium mb-2">
                        <FileText className="w-4 h-4" />
                        AI Prescription Auto-Created
                      </div>
                      <p className="text-sm text-white/90">
                        Diagnosis: {autoPrescriptions[alert.id].diagnosis}
                      </p>
                      <p className="text-xs text-white/60 mt-1">
                        Medicines:{" "}
                        {autoPrescriptions[alert.id].medicines
                          .map((m) => m.name)
                          .join(", ")}
                      </p>
                      <p className="text-[11px] text-white/40 mt-1 break-all">
                        Tx: {autoPrescriptions[alert.id].blockchainHash}
                      </p>
                    </div>
                  )}
                </div>
                <div className="flex gap-2 flex-shrink-0 ml-3">
                  {!alert.acknowledged_at && !alert.resolved && (
                    <button
                      onClick={() => acknowledgeAlert(alert.id)}
                      className="px-3 py-1.5 text-xs rounded-lg bg-primary-600 hover:bg-primary-500 text-white"
                    >
                      Acknowledge
                    </button>
                  )}
                  {!alert.resolved && (
                    <button
                      onClick={() => handleResolve(alert.id)}
                      className="px-3 py-1.5 text-xs rounded-lg bg-success-600 hover:bg-success-500 text-white"
                    >
                      Resolve
                    </button>
                  )}
                </div>
              </div>
            </GlassCard>
          ))}
        </div>
      )}
    </div>
  );
}

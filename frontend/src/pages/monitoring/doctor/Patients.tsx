import { useEffect, useState } from "react";
import { Users } from "lucide-react";
import { GlassCard } from "@/components/shared/GlassCard";
import { HealthScoreRing } from "@/components/shared/HealthScoreRing";
import api from "@/services/api";
import type { MonitoringPatient, HealthScore } from "@/types";
import { joinDoctorRoom, onVitalsUpdate } from "@/services/socket";

interface PatientWithScore {
  patient: MonitoringPatient;
  health_score: HealthScore | null;
}

export function DoctorMonitoringPatients(): React.ReactElement {
  const [patients, setPatients] = useState<PatientWithScore[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load(showInitialLoader = false) {
      if (showInitialLoader) {
        setLoading(true);
      }
      try {
        const { data } = await api.get("/patients");
        if (data.success) {
          const withScores: PatientWithScore[] = [];
          for (const p of data.data) {
            try {
              const detail = await api.get(`/patients/${p.id}`);
              withScores.push({
                patient: p,
                health_score: detail.data.data?.health_score || null,
              });
            } catch {
              withScores.push({ patient: p, health_score: null });
            }
          }
          setPatients(withScores);
        }
      } catch (error) {
        console.error("Failed to load patients:", error);
      }
      if (showInitialLoader) {
        setLoading(false);
      }
    }

    joinDoctorRoom();
    load(true);

    const refreshInterval = setInterval(() => {
      void load(false);
    }, 12000);

    const unsubVitals = onVitalsUpdate(() => {
      void load(false);
    });

    return () => {
      clearInterval(refreshInterval);
      unsubVitals();
    };
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Monitoring Patients</h1>

      {loading ? (
        <p className="text-white/40 text-center py-12">Loading patients...</p>
      ) : patients.length === 0 ? (
        <GlassCard className="text-center py-12">
          <Users className="w-12 h-12 text-white/20 mx-auto mb-3" />
          <p className="text-white/50">No patients registered.</p>
        </GlassCard>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {patients.map(({ patient, health_score }) => (
            <GlassCard key={patient.id} hoverable>
              <div className="flex items-center gap-4">
                <HealthScoreRing score={health_score?.score ?? 0} size="sm" />
                <div className="flex-1">
                  <h3 className="text-white font-medium">{patient.name}</h3>
                  <p className="text-xs text-white/40">{patient.phone}</p>
                  {patient.blood_group && (
                    <p className="text-xs text-white/40">
                      Blood: {patient.blood_group}
                    </p>
                  )}
                  {patient.chronic_conditions && (
                    <p className="text-xs text-warning-500 mt-1">
                      {patient.chronic_conditions}
                    </p>
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

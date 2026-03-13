import { useState, useRef, useCallback } from "react";
import { Play, Square, Zap, TrendingDown, AlertTriangle } from "lucide-react";
import { pushVitals } from "@/services/socket";
import { GlassCard } from "./GlassCard";

type Scenario = "normal" | "decline" | "crisis";

interface Props {
  patientId: string;
}

function randomInRange(min: number, max: number): number {
  return Math.round((Math.random() * (max - min) + min) * 10) / 10;
}

function generateNormalVitals(patientId: string) {
  return {
    patient_id: patientId,
    heart_rate: randomInRange(65, 85),
    spo2: randomInRange(96, 99),
    systolic_bp: randomInRange(110, 130),
    diastolic_bp: randomInRange(70, 85),
    temperature: randomInRange(36.2, 37.1),
    activity_level: "resting",
    device_id: "demo-simulator",
  };
}

function generateDeclineVitals(patientId: string, tick: number) {
  const progress = Math.min(tick / 15, 1);
  return {
    patient_id: patientId,
    heart_rate: randomInRange(70 + progress * 30, 80 + progress * 35),
    spo2: randomInRange(98 - progress * 8, 99 - progress * 6),
    systolic_bp: randomInRange(120 + progress * 25, 130 + progress * 30),
    diastolic_bp: randomInRange(75 + progress * 15, 85 + progress * 20),
    temperature: randomInRange(36.5 + progress * 1.5, 37.0 + progress * 2),
    activity_level: "resting",
    device_id: "demo-simulator",
  };
}

function generateCrisisVitals(patientId: string) {
  return {
    patient_id: patientId,
    heart_rate: randomInRange(120, 150),
    spo2: randomInRange(83, 90),
    systolic_bp: randomInRange(160, 190),
    diastolic_bp: randomInRange(100, 120),
    temperature: randomInRange(39.0, 40.2),
    activity_level: "resting",
    device_id: "demo-simulator",
  };
}

const scenarios: Record<
  Scenario,
  { label: string; icon: React.ReactNode; color: string; desc: string }
> = {
  normal: {
    label: "Normal",
    icon: <Play className="w-4 h-4" />,
    color: "bg-success-600 hover:bg-success-500",
    desc: "Stable vitals within healthy range",
  },
  decline: {
    label: "Decline",
    icon: <TrendingDown className="w-4 h-4" />,
    color: "bg-warning-600 hover:bg-warning-500",
    desc: "Gradual worsening over time",
  },
  crisis: {
    label: "Crisis",
    icon: <AlertTriangle className="w-4 h-4" />,
    color: "bg-danger-600 hover:bg-danger-500",
    desc: "Immediate critical readings",
  },
};

export function SimulatorPanel({ patientId }: Props): React.ReactElement {
  const [active, setActive] = useState<Scenario | null>(null);
  const [tick, setTick] = useState(0);
  const [count, setCount] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tickRef = useRef(0);

  const stop = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setActive(null);
    tickRef.current = 0;
    setTick(0);
  }, []);

  const start = useCallback(
    (scenario: Scenario) => {
      stop();
      setActive(scenario);
      tickRef.current = 0;
      setTick(0);

      const generate = () => {
        tickRef.current += 1;
        setTick(tickRef.current);
        setCount((c) => c + 1);

        let vitals;
        switch (scenario) {
          case "normal":
            vitals = generateNormalVitals(patientId);
            break;
          case "decline":
            vitals = generateDeclineVitals(patientId, tickRef.current);
            break;
          case "crisis":
            vitals = generateCrisisVitals(patientId);
            break;
        }
        pushVitals(vitals);
      };

      generate();
      intervalRef.current = setInterval(generate, 15000);
    },
    [patientId, stop],
  );

  return (
    <GlassCard>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-warning-500" />
          <h3 className="text-sm font-medium text-white/60">
            Device Simulator
          </h3>
        </div>
        {active && (
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-success-500 animate-pulse" />
            <span className="text-xs text-white/40">
              Tick {tick} | Sent {count}
            </span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 mb-3">
        {(
          Object.entries(scenarios) as [
            Scenario,
            (typeof scenarios)[Scenario],
          ][]
        ).map(([key, s]) => (
          <button
            key={key}
            onClick={() => start(key)}
            disabled={active === key}
            className={`flex flex-col items-center gap-1 p-3 rounded-xl text-white text-xs font-medium transition-all ${
              active === key ? "ring-2 ring-white/30 opacity-80" : s.color
            } ${active && active !== key ? "opacity-50" : ""}`}
          >
            {s.icon}
            {s.label}
          </button>
        ))}
      </div>

      {active && (
        <button
          onClick={stop}
          className="w-full flex items-center justify-center gap-2 p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs transition-all"
        >
          <Square className="w-3 h-3" />
          Stop Simulation
        </button>
      )}

      {!active && (
        <p className="text-xs text-white/30 text-center">
          Select a scenario to start pushing simulated vitals
        </p>
      )}
    </GlassCard>
  );
}

import clsx from "clsx";

interface Props {
  score: number;
  size?: "sm" | "md" | "lg";
}

function getColor(score: number): string {
  if (score >= 80) return "text-success-500";
  if (score >= 60) return "text-warning-500";
  if (score >= 40) return "text-orange-400";
  return "text-danger-500";
}

const dims: Record<string, { box: string; text: string; ring: number }> = {
  sm: { box: "w-20 h-20", text: "text-xl", ring: 30 },
  md: { box: "w-32 h-32", text: "text-3xl", ring: 50 },
  lg: { box: "w-40 h-40", text: "text-4xl", ring: 62 },
};

export function HealthScoreRing({
  score,
  size = "md",
}: Props): React.ReactElement {
  const { box, text, ring } = dims[size];
  const circumference = 2 * Math.PI * ring;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className={clsx("relative flex items-center justify-center", box)}>
      <svg className="absolute inset-0 -rotate-90" viewBox="0 0 140 140">
        <circle
          cx="70"
          cy="70"
          r={ring}
          fill="none"
          stroke="rgba(255,255,255,0.05)"
          strokeWidth="8"
        />
        <circle
          cx="70"
          cy="70"
          r={ring}
          fill="none"
          className={clsx("transition-all duration-1000")}
          stroke="currentColor"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{
            color:
              score >= 80
                ? "#10b981"
                : score >= 60
                  ? "#f59e0b"
                  : score >= 40
                    ? "#fb923c"
                    : "#ef4444",
          }}
        />
      </svg>
      <div className="text-center">
        <span className={clsx("font-bold", text, getColor(score))}>
          {score}
        </span>
        <p className="text-xs text-white/40">/ 100</p>
      </div>
    </div>
  );
}

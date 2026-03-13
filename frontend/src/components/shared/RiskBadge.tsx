import clsx from "clsx";
import type { RiskLevel } from "@/types";

interface Props {
  level: RiskLevel;
  size?: "sm" | "md" | "lg";
}

const colors: Record<RiskLevel, string> = {
  LOW: "bg-success-600/20 text-success-500 border-success-500/30",
  MEDIUM: "bg-warning-600/20 text-warning-500 border-warning-500/30",
  HIGH: "bg-orange-600/20 text-orange-400 border-orange-500/30",
  CRITICAL:
    "bg-danger-600/20 text-danger-500 border-danger-500/30 animate-pulse",
};

const sizes: Record<string, string> = {
  sm: "px-2 py-0.5 text-xs",
  md: "px-3 py-1 text-sm",
  lg: "px-4 py-1.5 text-base",
};

export function RiskBadge({ level, size = "md" }: Props): React.ReactElement {
  return (
    <span
      className={clsx(
        "font-semibold rounded-full border",
        colors[level],
        sizes[size],
      )}
    >
      {level}
    </span>
  );
}

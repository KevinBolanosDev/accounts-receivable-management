import * as React from "react";

import { cn } from "@/shared/lib/utils";

// DESIGN_SYSTEM.md §1.7 — 32 mini / 64 mediano / 120 hero, trazo 4–6px.
const RING_SIZES = {
  mini: { px: 32, strokeWidth: 4, fontSize: 10, showLabelDefault: false },
  md: { px: 64, strokeWidth: 5, fontSize: 15, showLabelDefault: true },
  hero: { px: 120, strokeWidth: 6, fontSize: 28, showLabelDefault: true },
} as const;

type ProgressRingSize = keyof typeof RING_SIZES;

interface ProgressRingProps extends Omit<React.ComponentProps<"div">, "children"> {
  /** Porcentaje 0–100. Es el valor objetivo: FASE_0.5.5 anima el trazo/número hacia este valor. */
  value: number;
  size?: ProgressRingSize;
  /** Por defecto solo se muestra el número en md/hero — a 32px no cabe con legibilidad. */
  showLabel?: boolean;
  /** DESIGN_SYSTEM.md §1.7 — a partir de aquí el trazo vira de --accent a --success. */
  completeThreshold?: number;
}

function ProgressRing({
  value,
  size = "md",
  showLabel,
  completeThreshold = 90,
  className,
  ...props
}: ProgressRingProps) {
  const clamped = Math.min(100, Math.max(0, value));
  const rounded = Math.round(clamped);
  const { px, strokeWidth, fontSize, showLabelDefault } = RING_SIZES[size];
  const radius = (px - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - clamped / 100);
  const isComplete = clamped >= completeThreshold;
  const label = showLabel ?? showLabelDefault;

  return (
    <div
      data-slot="progress-ring"
      data-size={size}
      data-complete={isComplete || undefined}
      data-value={rounded}
      className={cn("relative inline-flex shrink-0 items-center justify-center", className)}
      style={{ width: px, height: px }}
      role="progressbar"
      aria-valuenow={rounded}
      aria-valuemin={0}
      aria-valuemax={100}
      {...props}
    >
      <svg width={px} height={px} viewBox={`0 0 ${px} ${px}`} className="-rotate-90">
        <circle
          cx={px / 2}
          cy={px / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          className="stroke-border"
        />
        <circle
          data-slot="progress-ring-arc"
          data-circumference={circumference}
          cx={px / 2}
          cy={px / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={cn("transition-colors", isComplete ? "stroke-success" : "stroke-accent")}
        />
      </svg>
      {label && (
        <span
          data-slot="progress-ring-value"
          data-value={rounded}
          className="text-foreground absolute font-semibold tabular-nums"
          style={{ fontSize }}
        >
          {rounded}%
        </span>
      )}
    </div>
  );
}

export { ProgressRing, RING_SIZES };
export type { ProgressRingProps, ProgressRingSize };

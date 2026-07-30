import * as React from "react";

import { cn } from "@/shared/lib/utils";

type ProgressTone = "accent" | "success" | "warning" | "gradient" | "auto";

interface ProgressBarProps extends React.ComponentProps<"div"> {
  /** Porcentaje 0–100. */
  value: number;
  /**
   * "auto" vira: ≥100 verde, <50 ámbar, si no cian.
   * "gradient" es el degradado de firma índigo→cian: se usa cuando la barra
   * ES el elemento visual de la tarjeta (avance de crédito, avance del día de
   * una ruta), no cuando comunica un estado que hay que leer por color.
   */
  tone?: ProgressTone;
}

function resolveTone(value: number, tone: ProgressTone): Exclude<ProgressTone, "auto"> {
  if (tone !== "auto") return tone;
  if (value >= 100) return "success";
  if (value < 50) return "warning";
  return "accent";
}

const FILL_CLASS: Record<Exclude<ProgressTone, "auto">, string> = {
  accent: "bg-accent",
  success: "bg-success",
  warning: "bg-warning",
  gradient: "bg-linear-to-r from-primary to-accent",
};

// Barra de avance horizontal (avance del día en 6c/7b, progreso de crédito en 5c).
function ProgressBar({ value, tone = "auto", className, ...props }: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, value));
  const resolved = resolveTone(clamped, tone);

  return (
    <div
      data-slot="progress-bar"
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn("h-1.5 w-full overflow-hidden rounded-full bg-border", className)}
      {...props}
    >
      <div
        className={cn("h-full rounded-full transition-[width]", FILL_CLASS[resolved])}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

export { ProgressBar };

import * as React from "react";

import { cn } from "@/shared/lib/utils";

type MetricTone = "primary" | "success" | "accent";

const CHIP_CLASS: Record<MetricTone, string> = {
  primary: "bg-primary/10 text-primary",
  success: "bg-success/10 text-success",
  accent: "bg-accent/10 text-accent",
};

interface MetricCardProps extends React.ComponentProps<"div"> {
  icon?: React.ReactNode;
  label: string;
  value: React.ReactNode;
  /** Texto muted junto al valor (ej. "de 6"). */
  sub?: React.ReactNode;
  tone?: MetricTone;
}

// DESIGN_SYSTEM.md §2.4 — Metric card: chip de ícono + etiqueta + valor. Se usa
// en las tiras de resumen (6c, 11a) y KPIs de las vistas Admin.
function MetricCard({ icon, label, value, sub, tone = "primary", className, ...props }: MetricCardProps) {
  return (
    <div
      data-slot="metric-card"
      className={cn(
        "flex items-center gap-4 rounded-lg border border-border bg-card p-4",
        className,
      )}
      {...props}
    >
      {icon ? (
        <span
          className={cn(
            "flex size-11 shrink-0 items-center justify-center rounded-lg [&_svg]:size-5",
            CHIP_CLASS[tone],
          )}
        >
          {icon}
        </span>
      ) : null}
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-caption text-muted-foreground uppercase">{label}</span>
        <span className="text-h2 leading-none font-semibold tabular-nums">
          {value}
          {sub ? <span className="ml-1.5 text-sm font-normal text-muted-foreground">{sub}</span> : null}
        </span>
      </div>
    </div>
  );
}

export { MetricCard };

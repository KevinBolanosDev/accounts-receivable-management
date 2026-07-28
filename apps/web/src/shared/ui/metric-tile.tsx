import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/shared/lib/utils";

// Tira de métricas. Distinto de `metric-card.tsx` (variante con chip de icono,
// usada en Admin): esto es el tile compacto de las pantallas del Cobrador y del
// Portal, que hasta ahora estaba copiado como `MetricTile`/`SummaryStat`/
// `Stat`/`KpiRow` en cinco archivos distintos.

const metricTileVariants = cva("flex min-w-0 flex-col gap-0.5", {
  variants: {
    align: {
      start: "items-start text-left",
      center: "items-center text-center",
    },
    tone: {
      default: "",
      success: "[&_[data-slot=metric-tile-value]]:text-success",
      warning: "[&_[data-slot=metric-tile-value]]:text-warning",
      destructive: "[&_[data-slot=metric-tile-value]]:text-destructive",
    },
  },
  defaultVariants: { align: "center", tone: "default" },
});

interface MetricTileProps
  extends React.ComponentProps<"div">,
    VariantProps<typeof metricTileVariants> {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
}

export function MetricTile({
  label,
  value,
  sub,
  align,
  tone,
  className,
  ...props
}: MetricTileProps) {
  return (
    <div
      data-slot="metric-tile"
      className={cn(metricTileVariants({ align, tone }), className)}
      {...props}
    >
      <span
        data-slot="metric-tile-value"
        className="text-h3 leading-none font-bold tabular-nums"
      >
        {value}
      </span>
      <span className="text-caption text-muted-foreground">{label}</span>
      {sub ? <span className="text-caption text-muted-foreground">{sub}</span> : null}
    </div>
  );
}

interface MetricTileGroupProps extends React.ComponentProps<"div"> {
  columns?: 2 | 3 | 4;
  /** Separadores verticales entre tiles. */
  divided?: boolean;
  /**
   * Superpone la tarjeta al hero degradado (`-mt-9` + sombra). Es la
   * composición que las pantallas del cobrador repetían a mano.
   */
  overlap?: boolean;
}

export function MetricTileGroup({
  columns = 3,
  divided = false,
  overlap = false,
  className,
  children,
  ...props
}: MetricTileGroupProps) {
  const grid = { 2: "grid-cols-2", 3: "grid-cols-3", 4: "grid-cols-2 sm:grid-cols-4" }[columns];

  return (
    <div
      data-slot="metric-tile-group"
      className={cn(
        "grid items-center rounded-xl border border-border bg-card p-4",
        grid,
        divided && "divide-x divide-border",
        overlap && "relative z-10 -mt-9 shadow-md",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

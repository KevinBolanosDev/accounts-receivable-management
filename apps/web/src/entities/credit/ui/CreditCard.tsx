import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import type { CreditoListItem } from "@repo/types";

import { formatCurrency } from "@/shared/lib/format-currency";
import { cn } from "@/shared/lib/utils";
import { Badge } from "@/shared/ui/badge";
import { ProgressRing } from "@/shared/ui/progress-ring";

import { porcentajePagado } from "../lib/credit-progress";

// DESIGN_SYSTEM.md §3.10 — tarjeta de crédito:
// anillo hero de progreso + monto en tipografía display + badge de estado +
// cuota diaria. Dos densidades: hero (10a / 5c) y compacta (16c móvil, §4.3).
// `entities/credit` usa `shared`; nunca `features`.

const ESTADO_CREDITO_LABEL: Record<CreditoListItem["estado"], string> = {
  ACTIVO: "Activo",
  PAGADO: "Pagado",
  MORA: "Mora",
  ANULADO: "Anulado",
};

const ESTADO_CREDITO_BADGE_STATUS: Record<
  CreditoListItem["estado"],
  React.ComponentProps<typeof Badge>["status"]
> = {
  ACTIVO: "activo",
  PAGADO: "pagado",
  MORA: "mora",
  ANULADO: "ruta-cerrada",
};

const cardVariants = cva(
  "flex items-center gap-5 rounded-lg border border-border bg-card",
  {
    variants: {
      density: {
        hero: "p-6",
        compact: "p-4",
      },
    },
    defaultVariants: {
      density: "hero",
    },
  },
);

const ringSizeByDensity: Record<"hero" | "compact", "md" | "hero"> = {
  hero: "hero",
  compact: "md",
};

interface CreditCardProps
  extends Omit<React.ComponentProps<"div">, "children">,
    VariantProps<typeof cardVariants> {
  credito: CreditoListItem;
  /** Cliente del crédito (se muestra en la hero). Opcional para la compacta. */
  clienteNombre?: string;
  /** Acción al tappear la tarjeta (16c móvil). */
  onClick?: () => void;
}

function CreditCard({
  credito,
  clienteNombre,
  density = "hero",
  className,
  onClick,
  ...props
}: CreditCardProps) {
  const porcentaje = porcentajePagado(credito);
  const clickable = typeof onClick === "function";

  return (
    <div
      data-slot="credit-card"
      data-density={density}
      data-estado={credito.estado}
      onClick={onClick}
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      className={cn(
        cardVariants({ density }),
        clickable && "cursor-pointer transition-colors hover:bg-muted",
        className,
      )}
      {...props}
    >
      <ProgressRing value={porcentaje} size={ringSizeByDensity[density ?? "hero"]} />

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 flex-col">
            <span className="text-caption text-muted-foreground uppercase tracking-wide">
              {credito.codigo}
              {clienteNombre ? ` · ${clienteNombre}` : ""}
            </span>
            <span className="truncate text-sm font-medium">{credito.producto.nombre}</span>
          </div>
          <Badge status={ESTADO_CREDITO_BADGE_STATUS[credito.estado]}>
            {ESTADO_CREDITO_LABEL[credito.estado]}
          </Badge>
        </div>

        {density === "hero" ? (
          <div className="flex items-baseline gap-3">
            <span className="text-display tabular-nums">
              {formatCurrency(credito.saldoPendiente)}
            </span>
            <span className="text-caption text-muted-foreground">
              de {formatCurrency(credito.montoTotal)}
            </span>
          </div>
        ) : (
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-h2 font-semibold tabular-nums">
              {formatCurrency(credito.saldoPendiente)}
            </span>
            <span className="text-caption text-muted-foreground">
              {porcentaje}% pagado
            </span>
          </div>
        )}

        <div className="flex items-center justify-between text-caption text-muted-foreground">
          <span>
            Cuota diaria{" "}
            <span className="font-medium text-foreground tabular-nums">
              {formatCurrency(credito.cuotaDiaria)}
            </span>
          </span>
          {density === "hero" ? (
            <span className="tabular-nums">
              {credito.cuotasPagadas} / {credito.cuotasTotal} cuotas
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export { CreditCard };
export type { CreditCardProps };

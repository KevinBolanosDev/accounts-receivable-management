import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import type { CreditoListItem } from "@repo/types";

import { formatDate } from "@/shared/lib/format-date";
import { formatCurrency } from "@/shared/lib/format-currency";
import { cn } from "@/shared/lib/utils";
import { Badge } from "@/shared/ui/badge";
import { ProgressBar } from "@/shared/ui/progress-bar";

import { porcentajePagado } from "../lib/credit-progress";

// DESIGN_SYSTEM.md §3.10 — tarjeta de crédito. Estructura (prototipo m5):
//
//   Refrigerador  [Activo]                              34/50
//   Crédito #CR-2041 · abierto 18 jun 2026
//   ▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░                    (barra degradada)
//   Monto total        Pagado          Cuotas restantes
//   $1.000.000         $680.000                      16
//
// El anillo de progreso salió de la tarjeta: en una lista de créditos, tres
// anillos compitiendo entre sí no dicen más que tres barras, y el anillo pasó
// a ser el elemento de firma del hero de la pantalla (uno por vista).
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

const cardVariants = cva("flex flex-col gap-3 rounded-lg border border-border bg-card", {
  variants: {
    density: {
      hero: "p-6",
      compact: "p-4",
    },
  },
  defaultVariants: {
    density: "hero",
  },
});

interface CreditCardProps
  extends Omit<React.ComponentProps<"div">, "children">,
    VariantProps<typeof cardVariants> {
  credito: CreditoListItem;
  /** Cliente del crédito. Se muestra en la línea de metadatos si viene. */
  clienteNombre?: string;
  /** Acción al tappear la tarjeta (16c móvil). */
  onClick?: () => void;
}

/** Una columna del pie de cifras. */
function Figure({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="truncate text-caption text-muted-foreground">{label}</span>
      <span className={cn("truncate text-sm font-semibold tabular-nums", valueClassName)}>
        {value}
      </span>
    </div>
  );
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
  const cuotasRestantes = Math.max(0, credito.cuotasTotal - credito.cuotasPagadas);

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
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span
              className={cn(
                "truncate font-semibold",
                density === "hero" ? "text-h3" : "text-sm",
              )}
            >
              {credito.producto}
            </span>
            <Badge status={ESTADO_CREDITO_BADGE_STATUS[credito.estado]}>
              {ESTADO_CREDITO_LABEL[credito.estado]}
            </Badge>
          </div>
          <span className="truncate text-caption text-muted-foreground">
            Crédito {credito.codigo}
            {clienteNombre ? ` · ${clienteNombre}` : ""} · abierto{" "}
            {formatDate(credito.fechaInicio)}
          </span>
        </div>

        <span className="shrink-0 text-caption text-muted-foreground tabular-nums">
          {credito.cuotasPagadas}/{credito.cuotasTotal}
        </span>
      </div>

      <ProgressBar value={porcentaje} tone="gradient" />

      {/* `grid-cols-3` fijo y no `flex`: las tres cifras deben quedar
          alineadas entre tarjetas apiladas, aunque los montos midan distinto. */}
      <div className="grid grid-cols-3 gap-3">
        <Figure label="Monto total" value={formatCurrency(credito.montoTotal)} />
        <Figure
          label="Pagado"
          value={formatCurrency(credito.totalPagado)}
          valueClassName="text-success"
        />
        <Figure label="Cuotas restantes" value={String(cuotasRestantes)} />
      </div>
    </div>
  );
}

export { CreditCard };
export type { CreditCardProps };

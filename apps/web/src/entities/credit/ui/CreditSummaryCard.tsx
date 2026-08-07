import * as React from "react";
import Link from "next/link";
import { ChevronRightIcon } from "lucide-react";
import type { CreditoListItem } from "@repo/types";

import { formatCurrency } from "@/shared/lib/format-currency";
import { PRESS_SCALE } from "@/shared/lib/motion";
import { cn } from "@/shared/lib/utils";
import { ProgressRing } from "@/shared/ui/progress-ring";

import { CUOTA_SUFIJO } from "../lib/frecuencia";

export interface CreditSummaryCardProps extends Omit<React.ComponentProps<"div">, "onSelect"> {
  credito: Pick<
    CreditoListItem,
    | "id"
    | "codigo"
    | "producto"
    | "estado"
    | "saldoPendiente"
    | "totalPagado"
    | "cuotaDiaria"
    | "frecuencia"
    | "cuotasPagadas"
    | "cuotasTotal"
    | "porcentajePagado"
  >;
  /** Qué cifra se muestra a la derecha. */
  amountKind?: "saldo" | "pagado";
  /** Línea meta libre (ej. "12 pagos · último 27 jul, 3:42 p. m."). */
  meta?: React.ReactNode;
  badge?: React.ReactNode;
  /** Navega al pulsar (stretched link — ver `ClientCard`). */
  href?: string;
  /**
   * SLOT bajo la tarjeta. Es lo que permite al Cobrador inyectar
   * `<RegistrarCobroSheet>` (un componente de FEATURE) sin que esta entity
   * tenga que importarlo: la regla de FSD sería imposible de cumplir si la
   * tarjeta conociera el botón.
   */
  footer?: React.ReactNode;
}

const AMOUNT_LABEL = { saldo: "saldo", pagado: "pagado" } as const;

/**
 * Tarjeta de un crédito dentro de una lista, tappable hacia su detalle.
 * La usan la lista "Mis créditos" del Portal y la pestaña Historial del
 * Cobrador — antes cada una tenía su propia copia.
 *
 * `CreditCard` (hermana) sigue siendo la tarjeta informativa hero/compact de
 * Admin: otra jerarquía visual, otro caso de uso.
 */
export function CreditSummaryCard({
  credito,
  amountKind = "saldo",
  meta,
  badge,
  href,
  footer,
  className,
  ...props
}: CreditSummaryCardProps) {
  const amount = amountKind === "saldo" ? credito.saldoPendiente : credito.totalPagado;

  return (
    <div
      data-slot="credit-summary-card"
      data-estado={credito.estado}
      className={cn(
        "relative flex flex-col gap-3 rounded-xl border border-border bg-card p-4",
        href && cn("transition-colors hover:bg-muted", PRESS_SCALE),
        className,
      )}
      {...props}
    >
      <div className="flex items-center gap-3">
        {href ? (
          <Link
            href={href}
            aria-label={`${credito.producto} · ${credito.codigo}`}
            className="absolute inset-0 z-0 rounded-xl focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          />
        ) : null}

        <ProgressRing value={credito.porcentajePagado} size="mini" className="z-10" />

        <div className="z-10 flex min-w-0 flex-1 flex-col gap-0.5">
          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate text-body-sm font-semibold">{credito.producto}</span>
            {badge}
          </div>
          <span className="truncate text-caption text-muted-foreground">
            {credito.codigo} · {formatCurrency(credito.cuotaDiaria)}
            {CUOTA_SUFIJO[credito.frecuencia]}
          </span>
          <span className="truncate text-caption text-muted-foreground">
            {meta ?? `${credito.cuotasPagadas}/${credito.cuotasTotal} cuotas`}
          </span>
        </div>

        <div className="z-10 flex shrink-0 flex-col items-end">
          <span className="text-body-sm font-bold tabular-nums">{formatCurrency(amount)}</span>
          <span className="text-caption text-muted-foreground">{AMOUNT_LABEL[amountKind]}</span>
        </div>

        {/* Afordancia de "esto se puede abrir" — igual que las tarjetas de ruta. */}
        {href ? (
          <ChevronRightIcon className="z-10 size-4 shrink-0 text-muted-foreground" aria-hidden />
        ) : null}
      </div>

      {/* z-10: por encima del stretched link, si no el botón no sería clicable. */}
      {footer ? <div className="z-10">{footer}</div> : null}
    </div>
  );
}

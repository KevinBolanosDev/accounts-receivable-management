import * as React from "react";
import type { PaymentHistoryItem } from "@repo/types";

import { formatCurrency } from "@/shared/lib/format-currency";
import { formatDateShort, formatDateTimeShort } from "@/shared/lib/format-date";
import { cn } from "@/shared/lib/utils";
import { Badge } from "@/shared/ui/badge";
import {
  CUOTA_ESTADO_BADGE_STATUS,
  CUOTA_ESTADO_LABEL_SHORT,
  esCuotaSinPagar,
} from "../lib/cuota-estado";

export interface PaymentRowProps extends React.ComponentProps<"div"> {
  pago: PaymentHistoryItem;
  /** Para mostrar "Cuota 3/30" en vez de solo "Cuota 3". */
  cuotasTotal?: number;
  /** Título de la fila cuando el historial mezcla créditos (nombre del producto). */
  producto?: string;
  /**
   * SLOT de acciones (descargar/compartir recibo). Es un nodo, no una función:
   * así esta entity nunca importa el service de recibos ni un componente de
   * feature — quien compone decide qué acciones existen en cada superficie.
   */
  actions?: React.ReactNode;
}

/** Fila de historial para móvil. La versión de escritorio es `PaymentHistoryTable`. */
export function PaymentRow({
  pago,
  cuotasTotal,
  producto,
  actions,
  className,
  ...props
}: PaymentRowProps) {
  const sinPagar = esCuotaSinPagar(pago.estado);

  return (
    <div
      data-slot="payment-row"
      data-estado={pago.estado}
      className={cn(
        "flex items-center gap-3 rounded-xl border border-border bg-card p-3",
        pago.estado === "PENDING" && "opacity-70",
        className,
      )}
      {...props}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex items-center gap-2">
          <span className="truncate text-body-sm font-semibold">{producto ?? "Cuota"}</span>
          <Badge status={CUOTA_ESTADO_BADGE_STATUS[pago.estado]}>
            {CUOTA_ESTADO_LABEL_SHORT[pago.estado]}
          </Badge>
        </div>
        <span className="truncate text-caption text-muted-foreground">
          Cuota {pago.numeroCuota}
          {cuotasTotal ? `/${cuotasTotal}` : ""} · vence{" "}
          {formatDateShort(pago.fechaVencimiento)}
        </span>
        {/* Las dos fechas separadas: cuándo vencía (arriba) y cuándo se pagó
            realmente (acá). Antes se mostraba una sola y no se sabía cuál era. */}
        <span className="truncate text-caption text-muted-foreground">
          {pago.fechaPago
            ? `Pagado ${formatDateTimeShort(pago.fechaPago)}`
            : pago.diasAtraso > 0
              ? `Sin pagar · hace ${pago.diasAtraso} ${pago.diasAtraso === 1 ? "día" : "días"}`
              : "Sin pagar"}
        </span>
        {pago.reciboCodigo ? (
          <span className="truncate text-caption text-muted-foreground">
            Ref. {pago.reciboCodigo}
          </span>
        ) : null}
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <span className="text-body-sm font-bold tabular-nums">
          {/* Una cuota sin pagar no tiene monto: mostrar $0 haría creer que se
              registró un pago de cero. */}
          {sinPagar ? "—" : formatCurrency(pago.monto)}
        </span>
        {actions}
      </div>
    </div>
  );
}

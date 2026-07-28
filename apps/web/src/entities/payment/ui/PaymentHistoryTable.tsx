import * as React from "react";
import type { PaymentHistoryItem } from "@repo/types";

import { formatCurrency } from "@/shared/lib/format-currency";
import { formatDateShort, formatDateTimeShort } from "@/shared/lib/format-date";
import { Badge } from "@/shared/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui/table";
import {
  CUOTA_ESTADO_BADGE_STATUS,
  CUOTA_ESTADO_LABEL,
  esCuotaSinPagar,
} from "../lib/cuota-estado";

export type PaymentColumn =
  | "cuota"
  /** Cuándo TOCABA pagar. */
  | "vencimiento"
  /** Cuándo se pagó de verdad (o "—" si no se ha pagado). */
  | "pago"
  | "referencia"
  | "monto"
  | "estado"
  | "acciones";

const DEFAULT_COLUMNS: PaymentColumn[] = [
  "cuota",
  "vencimiento",
  "pago",
  "referencia",
  "monto",
  "estado",
  "acciones",
];

export interface PaymentHistoryTableProps {
  pagos: PaymentHistoryItem[];
  cuotasTotal?: number;
  columns?: PaymentColumn[];
  /**
   * Render-prop de acciones por fila. Misma frontera que `PaymentRow.actions`:
   * la entity no sabe nada de recibos ni de services.
   */
  renderActions?: (pago: PaymentHistoryItem) => React.ReactNode;
  emptyText?: string;
}

/** Historial en tabla (escritorio). La versión móvil es `PaymentRow`. */
export function PaymentHistoryTable({
  pagos,
  cuotasTotal,
  columns = DEFAULT_COLUMNS,
  renderActions,
  emptyText = "Todavía no hay pagos registrados.",
}: PaymentHistoryTableProps) {
  const show = (col: PaymentColumn) => columns.includes(col);

  if (pagos.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card p-6 text-center text-body-sm text-muted-foreground">
        {emptyText}
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          {show("cuota") ? <TableHead className="w-16">#</TableHead> : null}
          {show("vencimiento") ? <TableHead>Vence</TableHead> : null}
          {show("pago") ? <TableHead>Fecha pagado</TableHead> : null}
          {show("referencia") ? <TableHead>Ref.</TableHead> : null}
          {show("monto") ? <TableHead className="text-right">Monto</TableHead> : null}
          {show("estado") ? <TableHead>Estado</TableHead> : null}
          {show("acciones") && renderActions ? (
            <TableHead className="text-right">Recibo</TableHead>
          ) : null}
        </TableRow>
      </TableHeader>
      <TableBody>
        {pagos.map((pago) => {
          const sinPagar = esCuotaSinPagar(pago.estado);
          return (
            <TableRow
              key={pago.id}
              data-estado={pago.estado}
              className={pago.estado === "PENDING" ? "opacity-70" : ""}
            >
              {show("cuota") ? (
                <TableCell className="tabular-nums">
                  {pago.numeroCuota}
                  {cuotasTotal ? (
                    <span className="text-muted-foreground">/{cuotasTotal}</span>
                  ) : null}
                </TableCell>
              ) : null}
              {show("vencimiento") ? (
                <TableCell className="text-muted-foreground">
                  {formatDateShort(pago.fechaVencimiento)}
                </TableCell>
              ) : null}
              {show("pago") ? (
                // Con hora: un cliente puede abonar dos veces el mismo día y
                // sin la hora las filas serían indistinguibles.
                <TableCell>
                  {pago.fechaPago ? (
                    formatDateTimeShort(pago.fechaPago)
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
              ) : null}
              {show("referencia") ? (
                <TableCell className="text-muted-foreground">{pago.reciboCodigo ?? "—"}</TableCell>
              ) : null}
              {show("monto") ? (
                <TableCell className="text-right font-medium tabular-nums">
                  {sinPagar ? "—" : formatCurrency(pago.monto)}
                </TableCell>
              ) : null}
              {show("estado") ? (
                <TableCell>
                  <div className="flex flex-col items-start gap-0.5">
                    <Badge status={CUOTA_ESTADO_BADGE_STATUS[pago.estado]}>
                      {CUOTA_ESTADO_LABEL[pago.estado]}
                    </Badge>
                    {/* El "cuánto" del atraso: sin esto, "Vencida" y "En mora"
                        solo dicen en qué tramo cae, no de cuántos días habla. */}
                    {pago.diasAtraso > 0 ? (
                      <span className="text-caption text-muted-foreground">
                        {sinPagar ? "hace " : ""}
                        {pago.diasAtraso} {pago.diasAtraso === 1 ? "día" : "días"}
                      </span>
                    ) : null}
                  </div>
                </TableCell>
              ) : null}
              {show("acciones") && renderActions ? (
                <TableCell className="text-right">
                  <div className="flex justify-end">{renderActions(pago)}</div>
                </TableCell>
              ) : null}
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

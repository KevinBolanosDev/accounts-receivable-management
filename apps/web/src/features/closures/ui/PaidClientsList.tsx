"use client";

import type { ClosurePayment } from "@repo/types";

import { formatCurrency } from "@/shared/lib/format-currency";
import { getInitials } from "@/shared/lib/initials";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";

// Una fila por PAGO, no por cliente — alguien puede pagar más de una cuota
// el mismo día. Mismo patrón mobile-first que `UnpaidClientsList`, pero sin
// acciones (llamar/recordar no aplica a quien ya pagó).
function PaidClientRow({ pago }: { pago: ClosurePayment }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-background p-4">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold">
        {getInitials(pago.clienteNombre)}
      </span>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-medium">{pago.clienteNombre}</span>
        <span className="truncate text-caption text-muted-foreground">Cuota #{pago.numeroCuota}</span>
      </div>
      <span className="shrink-0 text-sm font-semibold tabular-nums text-success">
        {formatCurrency(pago.monto)}
      </span>
    </div>
  );
}

export function PaidClientsList({ payments }: { payments: ClosurePayment[] }) {
  return (
    <>
      {/* Tarjetas en móvil */}
      <div className="flex flex-col gap-3 md:hidden">
        {payments.map((pago, i) => (
          // Un cliente puede aparecer más de una vez (dos cuotas el mismo
          // día): la key combina cliente + cuota, no solo clienteId.
          <PaidClientRow key={`${pago.clienteId}-${pago.numeroCuota}-${i}`} pago={pago} />
        ))}
      </div>

      {/* Tabla desde md */}
      <div className="hidden overflow-hidden rounded-lg border border-border md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cliente</TableHead>
              <TableHead>Cuota</TableHead>
              <TableHead className="text-right">Monto</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payments.map((pago, i) => (
              <TableRow key={`${pago.clienteId}-${pago.numeroCuota}-${i}`}>
                <TableCell className="font-medium">{pago.clienteNombre}</TableCell>
                <TableCell className="text-muted-foreground">Cuota #{pago.numeroCuota}</TableCell>
                <TableCell className="text-right font-semibold tabular-nums text-success">
                  {formatCurrency(pago.monto)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}

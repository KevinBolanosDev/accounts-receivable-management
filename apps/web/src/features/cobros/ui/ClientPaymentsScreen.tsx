"use client";

import { useParams } from "next/navigation";

import { ESTADO_CLIENTE_LABEL } from "@/entities/client";
import { useCliente } from "@/features/clients/api/use-clientes";
import { getInitials } from "@/shared/lib/initials";
import { formatCurrency } from "@/shared/lib/format-currency";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { ProgressRing } from "@/shared/ui/progress-ring";
import { Skeleton } from "@/shared/ui/skeleton";
import { CollectorHero } from "@/widgets/collector-shell/CollectorHero";

import { RegistrarCobroSheet } from "./RegistrarCobroSheet";

// DESIGN_SYSTEM.md §3.5 / #16c — pagos del cliente (/collector/clients/payments/[id]).
// Hero de marca con avatar + estado, tarjeta superpuesta con el anillo de
// avance + saldo pendiente, la línea de cada crédito activo (producto ·
// cuota/día · cuotas) y el historial de pagos reciente. El botón fijo abre el
// bottom sheet de "Registrar cobro". Reusa `useCliente(id)` — el mismo hook
// real que el Admin (5c), ya scoped por cobrador en el backend
// (`GET /clients/:id` con `ruta.cobradorId = user.sub` para rol COBRADOR).

export function ClientPaymentsScreen() {
  const params = useParams<{ id: string }>();
  const clienteId = params.id;

  const { data: cliente, isLoading } = useCliente(clienteId);

  if (isLoading || !cliente) {
    return (
      <div className="flex flex-col pb-6">
        <CollectorHero title="Cliente" backHref="/collector" />
        <div className="relative z-10 -mt-9 flex flex-col gap-3 px-4">
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  const creditosActivos = cliente.creditosActivos;
  const historial = [...(cliente.historialPagos ?? [])].sort((a, b) =>
    b.fecha.localeCompare(a.fecha),
  );

  return (
    <div className="flex flex-col pb-28">
      <CollectorHero
        title={cliente.nombre}
        backHref={`/collector/routes/${cliente.rutaId}`}
        avatar={
          <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-white/20 text-lg font-semibold">
            {getInitials(cliente.nombre)}
          </span>
        }
        badge={
          cliente.estado ? (
            <span className="w-fit rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-medium">
              {ESTADO_CLIENTE_LABEL[cliente.estado]}
            </span>
          ) : undefined
        }
      />

      {/* Tarjeta superpuesta al hero (screenshot 16c). */}
      <div className="relative z-10 -mt-9 px-4">
        <div className="flex flex-col rounded-xl border border-border bg-card shadow-md">
          <div className="flex items-center gap-4 p-5">
            <ProgressRing value={cliente.porcentajePagado ?? 0} size="md" />
            <div className="flex min-w-0 flex-col">
              <span className="text-h1 font-bold tabular-nums">
                {formatCurrency(cliente.saldoPendiente ?? 0)}
              </span>
              <span className="text-body-sm text-muted-foreground">saldo pendiente</span>
            </div>
          </div>

          <div className="flex flex-col divide-y divide-border border-t border-border">
            {creditosActivos.length === 0 ? (
              <p className="p-5 text-body-sm text-muted-foreground">
                Este cliente no tiene créditos activos.
              </p>
            ) : (
              creditosActivos.map((credito) => (
                <div
                  key={credito.id}
                  className="flex items-center justify-between gap-3 px-5 py-3.5 text-sm"
                >
                  <span className="truncate text-muted-foreground">
                    {credito.producto} · {formatCurrency(credito.cuotaDiaria)}/día
                  </span>
                  <span className="shrink-0 font-semibold tabular-nums">
                    {credito.cuotasPagadas}/{credito.cuotasTotal} cuotas
                  </span>
                </div>
              ))
            )}
          </div>

          {historial.length > 0 ? (
            <div className="flex flex-col gap-2.5 border-t border-border p-5">
              <span className="text-caption font-semibold uppercase tracking-wide text-muted-foreground">
                Historial de pagos
              </span>
              {historial.slice(0, 3).map((pago) => (
                <div key={pago.id} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{fmtFecha(pago.fecha)}</span>
                  <span className="font-semibold tabular-nums">
                    {formatCurrency(pago.monto)}
                  </span>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      {/* Botón fijo — abre el bottom sheet de cobro. */}
      <div className="fixed right-0 bottom-16 left-0 z-10 mx-auto max-w-md border-t border-border bg-background/95 p-4 backdrop-blur">
        <RegistrarCobroSheet
          creditos={creditosActivos}
          clienteNombre={cliente.nombre}
          creditoPreseleccionado={
            creditosActivos.length === 1 ? creditosActivos[0] : undefined
          }
        >
          <Button
            size="lg"
            className={cn(
              "w-full bg-gradient-to-r from-primary to-accent text-primary-foreground",
              "hover:opacity-95",
            )}
            disabled={creditosActivos.length === 0}
          >
            Registrar cobro
          </Button>
        </RegistrarCobroSheet>
      </div>
    </div>
  );
}

function fmtFecha(iso: string): string {
  return new Date(iso).toLocaleDateString("es-CO", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

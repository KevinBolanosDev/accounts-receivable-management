"use client";

import { useMemo } from "react";
import { CheckIcon } from "lucide-react";
import type { ClienteDetail, CreditoListItem } from "@repo/types";

import { ClientContactPanel, ESTADO_CLIENTE_LABEL } from "@/entities/client";
import {
  CreditSummaryCard,
  contarCreditos,
  saldoPendienteDeCreditos,
  totalPagadoDeCreditos,
} from "@/entities/credit";
import {
  agruparPagosPorCredito,
  cobroDeHoy,
  pagosDeCredito,
  resumenHistorial,
  type CobroDeHoy,
} from "@/entities/payment";
import { useCliente } from "@/features/clients/api/use-clientes";
import { getInitials } from "@/shared/lib/initials";
import { formatCurrency } from "@/shared/lib/format-currency";
import { formatRelativeDateTime } from "@/shared/lib/format-date";
import { cn } from "@/shared/lib/utils";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { MetricTile, MetricTileGroup } from "@/shared/ui/metric-tile";
import { ProgressRing } from "@/shared/ui/progress-ring";
import { Skeleton } from "@/shared/ui/skeleton";
import { TabsContent, TabsList, TabsRoot, TabsTrigger } from "@/shared/ui/tabs";
import { CollectorHero } from "@/widgets/collector-shell/CollectorHero";

import { RegistrarCobroSheet } from "./RegistrarCobroSheet";

// DESIGN_SYSTEM.md §3.5 / #16c — pagos del cliente
// (/collector/routes/payments/[id]).
//
// La pestaña "Historial" NO lista pagos sueltos: lista un crédito por
// producto, y cada tarjeta abre el detalle de ESE crédito con sus propias
// cuotas (`/credits/[creditoId]`). Antes volcaba todas las cuotas de todos los
// créditos mezcladas en una sola lista plana, ilegible en cuanto el cliente
// tenía más de un crédito.
//
// Reusa `useCliente(id)` — el mismo hook real que el Admin (5c), ya scoped por
// cobrador en el backend.

export type ClientPaymentsTab = "activos" | "historial";

interface ClientPaymentsScreenProps {
  clienteId: string;
  /** Pestaña inicial. La resuelve el server component desde `?tab=`. */
  initialTab?: ClientPaymentsTab;
}

export function ClientPaymentsScreen({
  clienteId,
  initialTab = "activos",
}: ClientPaymentsScreenProps) {
  const { data: cliente, isLoading } = useCliente(clienteId);

  // Un crédito por producto para la pestaña Historial. Incluye los ACTIVOS que
  // ya tengan pagos: son los que concentran casi todo el historial, y esta
  // pestaña es la puerta de entrada al detalle por crédito.
  const creditosConPagos = useMemo(() => {
    if (!cliente) return [];
    const porCredito = agruparPagosPorCredito(cliente.historialPagos);
    const todos = [...cliente.creditosActivos, ...cliente.creditosHistorial];

    return todos
      .map((credito) => ({ credito, resumen: resumenHistorial(porCredito.get(credito.id) ?? []) }))
      .filter((fila) => fila.resumen.pagos > 0)
      .sort((a, b) => (b.resumen.ultimoPago ?? "").localeCompare(a.resumen.ultimoPago ?? ""));
  }, [cliente]);

  if (isLoading || !cliente) {
    return (
      <div className="flex flex-col pb-6">
        <CollectorHero title="Cliente" backHref="/collector" />
        <div className="relative z-10 -mt-9 flex flex-col gap-3 px-4">
          <Skeleton className="h-28 w-full rounded-xl" />
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-32 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  const creditosActivos = cliente.creditosActivos;
  const todosLosCreditos = [...cliente.creditosActivos, ...cliente.creditosHistorial];

  return (
    <div className="flex flex-col gap-4 pb-6">
      <CollectorHero
        title={cliente.nombre}
        // `rutaId` es nullable: un cliente sin ruta generaba
        // `/collector/routes/null`, que es un 404.
        backHref={cliente.rutaId ? `/collector/routes/${cliente.rutaId}` : "/collector"}
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

      {/* Resumen general superpuesto al hero (screenshot 16c). */}
      <div className="relative z-10 -mt-9 px-4">
        <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-5 shadow-md">
          <ProgressRing value={cliente.porcentajePagado ?? 0} size="md" />
          <div className="flex min-w-0 flex-col">
            <span className="text-h1 font-bold tabular-nums">
              {formatCurrency(cliente.saldoPendiente ?? 0)}
            </span>
            <span className="text-body-sm text-muted-foreground">saldo pendiente</span>
          </div>
        </div>
      </div>

      {/* Métricas del cliente: saldo, cuántos créditos y cuánto lleva pagado
          sumando TODOS sus créditos (no solo los activos). */}
      <div className="px-4">
        <MetricTileGroup columns={3} divided>
          <MetricTile
            label="Saldo pendiente"
            value={formatCurrency(saldoPendienteDeCreditos(todosLosCreditos))}
          />
          <MetricTile
            label="Créditos"
            value={String(contarCreditos(todosLosCreditos))}
            sub={`${creditosActivos.length} activo${creditosActivos.length === 1 ? "" : "s"}`}
          />
          <MetricTile
            label="Total pagado"
            value={formatCurrency(totalPagadoDeCreditos(todosLosCreditos))}
            tone="success"
          />
        </MetricTileGroup>
      </div>

      <div className="px-4">
        <ClientContactPanel cliente={cliente} />
      </div>

      <div className="px-4">
        <TabsRoot defaultValue={initialTab}>
          <TabsList>
            <TabsTrigger value="activos">Activos ({creditosActivos.length})</TabsTrigger>
            <TabsTrigger value="historial">Historial ({creditosConPagos.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="activos">
            <div className="flex flex-col gap-3">
              {creditosActivos.length === 0 ? (
                <EmptyState text="Este cliente no tiene créditos activos." />
              ) : (
                creditosActivos.map((credito) => (
                  <CreditoActivoCard
                    key={credito.id}
                    credito={credito}
                    cliente={cliente}
                    clienteId={clienteId}
                    cobradoHoy={cobroDeHoy(pagosDeCredito(cliente.historialPagos, credito.id))}
                  />
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="historial">
            <div className="flex flex-col gap-3">
              {creditosConPagos.length === 0 ? (
                <EmptyState text="Este cliente todavía no tiene pagos registrados." />
              ) : (
                creditosConPagos.map(({ credito, resumen }) => (
                  <CreditSummaryCard
                    key={credito.id}
                    credito={credito}
                    href={`/collector/routes/payments/${clienteId}/credits/${credito.id}`}
                    amountKind="pagado"
                    meta={`${resumen.pagos} pago${resumen.pagos === 1 ? "" : "s"} · último ${formatRelativeDateTime(resumen.ultimoPago)}`}
                    badge={
                      credito.estado === "PAGADO" ? (
                        <Badge status="pagado">Pagado</Badge>
                      ) : credito.estado === "MORA" ? (
                        <Badge status="mora">Mora</Badge>
                      ) : null
                    }
                    className="shadow-sm"
                  />
                ))
              )}
            </div>
          </TabsContent>
        </TabsRoot>
      </div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-card p-6 text-center">
      <p className="text-body-sm text-muted-foreground">{text}</p>
    </div>
  );
}

function CreditoActivoCard({
  credito,
  cliente,
  clienteId,
  cobradoHoy,
}: {
  credito: CreditoListItem;
  cliente: ClienteDetail;
  clienteId: string;
  cobradoHoy: CobroDeHoy | null;
}) {
  return (
    <CreditSummaryCard
      credito={credito}
      href={`/collector/routes/payments/${clienteId}/credits/${credito.id}`}
      className="shadow-sm"
      badge={
        // "Cobrado hoy" gana sobre "Mora": es el dato que el cobrador necesita
        // de un vistazo para no cobrar dos veces sin querer.
        cobradoHoy ? (
          <Badge status="pagado">
            <CheckIcon />
            Cobrado hoy
          </Badge>
        ) : credito.estado === "MORA" ? (
          <Badge status="mora">Mora</Badge>
        ) : null
      }
      meta={
        cobradoHoy
          ? `Hoy: ${formatCurrency(cobradoHoy.total)} en ${cobradoHoy.pagos} ${cobradoHoy.pagos === 1 ? "abono" : "abonos"} · ${credito.cuotasPagadas}/${credito.cuotasTotal} cuotas`
          : undefined
      }
      // `footer` es lo que permite meter un componente de FEATURE dentro de una
      // tarjeta que vive en `entities/` sin invertir la dirección del import.
      footer={
        <RegistrarCobroSheet
          creditos={[credito]}
          clienteNombre={cliente.nombre}
          creditoPreseleccionado={credito}
        >
          {/* El botón NO desaparece al cobrar: el cliente puede volver a
              abonar el mismo día o cancelar el crédito completo. Solo baja de
              jerarquía visual (secundario) para que no invite a repetir el
              cobro por inercia. */}
          <Button
            size="lg"
            variant={cobradoHoy ? "secondary" : "primary"}
            className={cn(
              "w-full",
              !cobradoHoy &&
                "bg-linear-to-r from-primary to-accent text-primary-foreground hover:opacity-95",
            )}
          >
            {cobradoHoy ? "Registrar otro abono" : "Registrar cobro"}
          </Button>
        </RegistrarCobroSheet>
      }
    />
  );
}

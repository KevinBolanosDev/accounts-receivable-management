"use client";

import { useMemo } from "react";
import { CheckIcon, CreditCardIcon } from "lucide-react";
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
import { useProgressRing } from "@/shared/lib/motion";
import { cn } from "@/shared/lib/utils";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { CountUpValue } from "@/shared/ui/count-up-value";
import { EmptyState } from "@/shared/ui/empty-state";
import { ErrorState, NotFoundState } from "@/shared/ui/error-state";
import { MetricTile, MetricTileGroup } from "@/shared/ui/metric-tile";
import { ProgressRing } from "@/shared/ui/progress-ring";
import { Skeleton } from "@/shared/ui/skeleton";
import { SkeletonCardList } from "@/shared/ui/skeletons";
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
  const { data: cliente, isLoading, isError, refetch } = useCliente(clienteId);
  const ringRef = useProgressRing<HTMLDivElement>(cliente?.porcentajePagado ?? 0);

  // Un crédito por producto para la pestaña Historial — SOLO terminados
  // (`cliente.creditosHistorial`: PAGADO o ANULADO). Antes también entraban
  // los ACTIVOS que ya tuvieran algún pago, y un crédito en curso aparecía en
  // las dos pestañas a la vez (ver el mismo fix en `AdminClientCreditsScreen`,
  // su espejo del Admin — se cambian juntas).
  const creditosTerminados = useMemo(() => {
    if (!cliente) return [];
    const porCredito = agruparPagosPorCredito(cliente.historialPagos);

    return cliente.creditosHistorial
      .map((credito) => ({ credito, resumen: resumenHistorial(porCredito.get(credito.id) ?? []) }))
      .sort((a, b) => (b.resumen.ultimoPago ?? "").localeCompare(a.resumen.ultimoPago ?? ""));
  }, [cliente]);

  if (isLoading) {
    return (
      <div className="flex flex-col pb-6">
        <CollectorHero title="Cliente" backHref="/collector" />
        <div className="relative z-10 -mt-9 flex flex-col gap-3 px-4">
          <Skeleton className="h-28 w-full rounded-xl" />
          <SkeletonCardList rows={2} />
        </div>
      </div>
    );
  }

  // Esta pantalla tenía `isLoading || !cliente` en la misma rama, así que un
  // cliente que ya no existe (o una red caída) dejaba el Skeleton girando
  // para siempre: el cobrador no veía ni el problema ni la salida. Son tres
  // estados distintos y ahora se tratan como tales.
  if (isError || !cliente) {
    return (
      <div className="flex flex-col pb-6">
        <CollectorHero title="Cliente" backHref="/collector" />
        <div className="relative z-10 -mt-9 px-4">
          {isError ? (
            <ErrorState
              title="No se pudo cargar el cliente"
              description="Revisá tu conexión y volvé a intentar."
              onRetry={() => void refetch()}
            />
          ) : (
            <NotFoundState
              entity="este cliente"
              description="Puede que ya no esté asignado a tu ruta."
              backHref="/collector"
              backLabel="Ir a mis rutas"
            />
          )}
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
        {/* `useProgressRing` hace acá el momento de firma del producto: al
            registrar un cobro desde esta misma pantalla, TanStack invalida y
            `porcentajePagado` sube — el anillo avanza desde donde estaba, no
            se redibuja desde cero. El cobrador ve crecer lo que acaba de
            cobrar. */}
        <div ref={ringRef} className="flex items-center gap-4 rounded-xl border border-border bg-card p-5 shadow-md">
          <ProgressRing value={cliente.porcentajePagado ?? 0} size="md" />
          <div className="flex min-w-0 flex-col">
            <span className="text-h1 font-bold tabular-nums">
              <CountUpValue
                value={cliente.saldoPendiente ?? 0}
                format={formatCurrency}
                token="hero"
              />
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
            <TabsTrigger value="historial">Historial ({creditosTerminados.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="activos">
            <div className="flex flex-col gap-3">
              {creditosActivos.length === 0 ? (
                <EmptyState
                  size="inline"
                  icon={<CreditCardIcon />}
                  title="Este cliente no tiene créditos activos"
                  description="No hay nada que cobrarle hoy."
                />
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
              {creditosTerminados.length === 0 ? (
                <EmptyState
                  size="inline"
                  icon={<CreditCardIcon />}
                  title="Todavía no tiene créditos terminados"
                  description="Acá van a aparecer los créditos pagados y los anulados."
                />
              ) : (
                creditosTerminados.map(({ credito, resumen }) => (
                  <CreditSummaryCard
                    key={credito.id}
                    credito={credito}
                    href={`/collector/routes/payments/${clienteId}/credits/${credito.id}`}
                    amountKind="pagado"
                    meta={
                      resumen.pagos > 0
                        ? `${resumen.pagos} pago${resumen.pagos === 1 ? "" : "s"} · último ${formatRelativeDateTime(resumen.ultimoPago)}`
                        : "Sin pagos registrados"
                    }
                    badge={
                      credito.estado === "PAGADO" ? (
                        <Badge status="pagado">Pagado</Badge>
                      ) : credito.estado === "ANULADO" ? (
                        <Badge status="ruta-cerrada">Anulado</Badge>
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

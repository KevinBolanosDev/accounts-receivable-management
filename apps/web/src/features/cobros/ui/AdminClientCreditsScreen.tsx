"use client";

import { useMemo } from "react";
import Link from "next/link";
import { CheckIcon, UserIcon } from "lucide-react";
import type { ClienteDetail, CreditoListItem } from "@repo/types";

import { ESTADO_CLIENTE_LABEL } from "@/entities/client";
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
import { formatPhone } from "@/shared/lib/phone";
import { formatCurrency } from "@/shared/lib/format-currency";
import { formatRelativeDateTime } from "@/shared/lib/format-date";
import { cn } from "@/shared/lib/utils";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { MetricTile, MetricTileGroup } from "@/shared/ui/metric-tile";
import { Skeleton } from "@/shared/ui/skeleton";
import { TabsContent, TabsList, TabsRoot, TabsTrigger } from "@/shared/ui/tabs";
import { AdminPageHeader } from "@/widgets/admin-shell/AdminPageHeader";
import { PageActions } from "@/widgets/admin-shell/PageActions";

import { RegistrarCobroSheet } from "./RegistrarCobroSheet";

// Créditos de un cliente DENTRO de una ruta, para el Admin
// (`/admin/routes-collectors/[id]/clients/[clienteId]`).
//
// Es el paso intermedio del flujo de cobro del Admin: desde el detalle de la
// ruta, un cliente ya NO abre su ficha completa (datos personales, documentos,
// acceso al portal) sino solo sus créditos — dos pestañas, Activos e Historial —
// porque lo que el admin viene a hacer acá es cobrar, no administrar al cliente.
// La ficha completa sigue a un click, en las acciones del header.
//
// Espeja a `ClientPaymentsScreen` (misma estructura de dos niveles y los mismos
// componentes de `entities/`), pero en la superficie del Admin: `AdminPageHeader`
// en vez del hero del cobrador, y sin el panel de contacto — el admin no está
// en la calle tocando el timbre.

export type AdminClientCreditsTab = "activos" | "historial";

interface AdminClientCreditsScreenProps {
  rutaId: string;
  clienteId: string;
  initialTab?: AdminClientCreditsTab;
}

export function AdminClientCreditsScreen({
  rutaId,
  clienteId,
  initialTab = "activos",
}: AdminClientCreditsScreenProps) {
  const { data: cliente, isLoading, isError } = useCliente(clienteId);

  // Un crédito por producto para la pestaña Historial — SOLO terminados
  // (`cliente.creditosHistorial`: PAGADO o ANULADO, ya separados así por el
  // backend). Antes también entraban los ACTIVOS que ya tuvieran algún pago,
  // así que un crédito en curso aparecía en las dos pestañas a la vez — el
  // criterio de "Historial" pasó a ser "¿tuvo pagos?" en vez de "¿terminó?".
  const creditosTerminados = useMemo(() => {
    if (!cliente) return [];
    const porCredito = agruparPagosPorCredito(cliente.historialPagos);

    return cliente.creditosHistorial
      .map((credito) => ({ credito, resumen: resumenHistorial(porCredito.get(credito.id) ?? []) }))
      .sort((a, b) => (b.resumen.ultimoPago ?? "").localeCompare(a.resumen.ultimoPago ?? ""));
  }, [cliente]);

  if (isLoading) {
    return (
      <>
        <AdminPageHeader
          backHref={`/admin/routes-collectors/${rutaId}`}
          eyebrow="Rutas"
          title="Créditos del cliente"
        />
        <div className="flex flex-col gap-3 p-4 sm:p-6">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </>
    );
  }

  // Mismo criterio que el detalle de ruta y de cliente: un 404 no deja la
  // pantalla en Skeleton para siempre.
  if (isError || !cliente) {
    return (
      <>
        <AdminPageHeader
          backHref={`/admin/routes-collectors/${rutaId}`}
          eyebrow="Rutas"
          title="Créditos del cliente"
        />
        <div className="flex flex-col items-center gap-4 p-4 sm:p-6">
          <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border bg-card p-8 text-center">
            <p className="text-sm font-medium">Este cliente no existe o fue eliminado</p>
            <p className="text-caption text-muted-foreground">
              Puede que lo hayas eliminado desde otra pestaña.
            </p>
          </div>
          <Button asChild variant="secondary">
            <Link href={`/admin/routes-collectors/${rutaId}`}>Volver a la ruta</Link>
          </Button>
        </div>
      </>
    );
  }

  const creditosActivos = cliente.creditosActivos;
  const todosLosCreditos = [...cliente.creditosActivos, ...cliente.creditosHistorial];

  return (
    <>
      <AdminPageHeader
        backHref={`/admin/routes-collectors/${rutaId}`}
        eyebrow={`Rutas / ${cliente.ruta?.nombre ?? "Sin ruta"} / ${cliente.nombre}`}
        title="Créditos del cliente"
        subtitle={
          cliente.estado
            ? `${ESTADO_CLIENTE_LABEL[cliente.estado]} · ${formatPhone(cliente.telefono)}`
            : formatPhone(cliente.telefono)
        }
        actions={
          <PageActions
            actions={[
              {
                id: "ficha",
                label: "Ver ficha del cliente",
                icon: <UserIcon />,
                href: `/admin/clients/${cliente.id}`,
              },
            ]}
          />
        }
      />

      <div className="flex min-w-0 flex-col gap-6 p-4 sm:p-6">
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

        <TabsRoot defaultValue={initialTab}>
          <TabsList>
            <TabsTrigger value="activos">Activos ({creditosActivos.length})</TabsTrigger>
            <TabsTrigger value="historial">Historial ({creditosTerminados.length})</TabsTrigger>
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
                    rutaId={rutaId}
                    cobradoHoy={cobroDeHoy(pagosDeCredito(cliente.historialPagos, credito.id))}
                  />
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="historial">
            <div className="flex flex-col gap-3">
              {creditosTerminados.length === 0 ? (
                <EmptyState text="Este cliente todavía no tiene créditos terminados." />
              ) : (
                creditosTerminados.map(({ credito, resumen }) => (
                  <CreditSummaryCard
                    key={credito.id}
                    credito={credito}
                    href={`/admin/routes-collectors/${rutaId}/clients/${cliente.id}/credits/${credito.id}`}
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
                  />
                ))
              )}
            </div>
          </TabsContent>
        </TabsRoot>
      </div>
    </>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-card p-6 text-center">
      <p className="text-body-sm text-muted-foreground">{text}</p>
    </div>
  );
}

function CreditoActivoCard({
  credito,
  cliente,
  rutaId,
  cobradoHoy,
}: {
  credito: CreditoListItem;
  cliente: ClienteDetail;
  rutaId: string;
  cobradoHoy: CobroDeHoy | null;
}) {
  return (
    <CreditSummaryCard
      credito={credito}
      href={`/admin/routes-collectors/${rutaId}/clients/${cliente.id}/credits/${credito.id}`}
      badge={
        // "Cobrado hoy" gana sobre "Mora": es lo que evita cobrar dos veces sin
        // querer, que es el riesgo real cuando cobran admin y cobrador.
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
      // Slot: mete un componente de FEATURE dentro de una tarjeta de `entities/`
      // sin invertir la dirección del import (ver `apps/web/CLAUDE.md`).
      footer={
        <RegistrarCobroSheet
          creditos={[credito]}
          clienteNombre={cliente.nombre}
          creditoPreseleccionado={credito}
          receiptBasePath="/admin/receipts"
        >
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

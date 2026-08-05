"use client";

import { DownloadIcon, PhoneIcon } from "lucide-react";
import type { UnpaidClient } from "@repo/types";

import { parseFechaInicio } from "@/entities/credit";
import { buildWhatsAppUrl } from "@/entities/receipt";
import { getInitials } from "@/shared/lib/initials";
import { formatCurrency } from "@/shared/lib/format-currency";
import { formatDate } from "@/shared/lib/format-date";
import { formatPhone, toDialableE164 } from "@/shared/lib/phone";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Skeleton } from "@/shared/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/tooltip";
import { WhatsAppIcon } from "@/shared/ui/icons/whatsapp-icon";
import { AdminPageHeader } from "@/widgets/admin-shell/AdminPageHeader";
import { PageActions } from "@/widgets/admin-shell/PageActions";

import { useClosureDetail } from "../api/use-closures";
import { buildPaymentReminderText } from "../lib/build-reminder-text";

// Ver el comentario del mismo helper en `ClosuresHistoryScreen.tsx`: `date`
// viaja como "YYYY-MM-DD" y necesita anclarse a mediodía UTC antes de
// formatear en `America/Bogota`, si no se ve un día atrás.
function fmtClosureDate(date: string): string {
  return formatDate(parseFechaInicio(date));
}

function ClientActions({ cliente }: { cliente: UnpaidClient }) {
  const disabled = !cliente.telefono;
  const dialable = cliente.telefono ? toDialableE164(cliente.telefono) : null;
  const reminderUrl = cliente.telefono
    ? buildWhatsAppUrl({
        text: buildPaymentReminderText(cliente.nombre, cliente.saldoPendiente),
        phone: cliente.telefono,
      })
    : null;

  const callButton = (
    <Button variant="secondary" size="sm" disabled={disabled} asChild={!disabled}>
      {disabled ? (
        <>
          <PhoneIcon />
          Llamar
        </>
      ) : (
        <a href={`tel:${dialable}`}>
          <PhoneIcon />
          Llamar
        </a>
      )}
    </Button>
  );

  const remindButton = (
    <Button variant="secondary" size="sm" disabled={disabled} asChild={!disabled}>
      {disabled ? (
        <>
          <WhatsAppIcon className="size-4" />
          Recordar
        </>
      ) : (
        <a href={reminderUrl!} target="_blank" rel="noopener noreferrer">
          <WhatsAppIcon className="size-4" />
          Recordar
        </a>
      )}
    </Button>
  );

  if (!disabled) {
    return (
      <div className="flex items-center gap-2">
        {callButton}
        {remindButton}
      </div>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="inline-flex items-center gap-2">
          {callButton}
          {remindButton}
        </div>
      </TooltipTrigger>
      <TooltipContent>Sin teléfono registrado</TooltipContent>
    </Tooltip>
  );
}

function UnpaidClientCard({ cliente }: { cliente: UnpaidClient }) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-background p-4">
      <div className="flex items-center gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold">
          {getInitials(cliente.nombre)}
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-sm font-medium">{cliente.nombre}</span>
          <span className="truncate text-caption text-muted-foreground">
            {formatPhone(cliente.telefono) || "Sin teléfono"}
          </span>
        </div>
        <span className="shrink-0 text-sm font-semibold tabular-nums text-destructive">
          {formatCurrency(cliente.saldoPendiente)}
        </span>
      </div>
      <ClientActions cliente={cliente} />
    </div>
  );
}

// DESIGN_SYSTEM.md §3.13 — Detalle del cierre (#13c). Snapshot congelado: lee
// `DailyClosure` tal como se persistió, nunca recalcula. Dos columnas desde
// `lg` (resumen + clientes sin pagar); apiladas en móvil, con la tabla de
// clientes reemplazada por tarjetas (mismo patrón mobile-first que
// `RoutesListScreen`).
export function ClosureDetailScreen({ id }: { id: string }) {
  const { data: closure, isLoading, isError } = useClosureDetail(id);

  if (isLoading) {
    return (
      <>
        <AdminPageHeader backHref="/admin/closures" eyebrow="Cierres" title="Detalle del cierre" />
        <div className="flex flex-col gap-4 p-4 sm:p-6">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </>
    );
  }

  if (isError || !closure) {
    return (
      <>
        <AdminPageHeader backHref="/admin/closures" eyebrow="Cierres" title="Detalle del cierre" />
        <div className="p-4 sm:p-6">
          <p className="rounded-lg border border-dashed border-border bg-card p-8 text-center text-body-sm text-muted-foreground">
            Este cierre no existe o no tienes acceso a él.
          </p>
        </div>
      </>
    );
  }

  return (
    <>
      <AdminPageHeader
        backHref="/admin/closures"
        eyebrow={`Cierres / ${fmtClosureDate(closure.date)}`}
        title={closure.rutaNombre}
        actions={
          <PageActions
            actions={[
              {
                id: "pdf",
                label: "Descargar PDF",
                icon: <DownloadIcon />,
                disabled: true,
                disabledReason: "El PDF se genera con el backend del cierre (Fase 5.8)",
              },
            ]}
          />
        }
      />

      <div className="grid min-w-0 flex-1 grid-cols-1 gap-6 p-4 sm:p-6 lg:grid-cols-[360px_minmax(0,1fr)]">
        {/* Resumen del cierre */}
        <div className="flex min-w-0 flex-col gap-5 rounded-lg border border-border bg-card p-6">
          <div className="flex items-center gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-semibold">
              {closure.closedByNombre ? getInitials(closure.closedByNombre) : "—"}
            </span>
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-sm font-semibold">
                {closure.closedByNombre ?? "Cierre automático"}
              </span>
              <span className="truncate text-caption text-muted-foreground">{closure.rutaNombre}</span>
            </div>
          </div>

          <dl className="flex flex-col gap-3 text-sm">
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">Fecha</dt>
              <dd className="font-medium">{fmtClosureDate(closure.date)}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">Estado</dt>
              <dd>
                <Badge status={closure.status === "OPEN" ? "ruta-abierta" : "ruta-cerrada"}>
                  {closure.status === "OPEN" ? "Abierta" : "Cerrada"}
                </Badge>
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">Total cobrado</dt>
              <dd className="font-semibold tabular-nums">{formatCurrency(closure.totalCollected)}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">Créditos nuevos</dt>
              <dd className="font-medium tabular-nums">{closure.newCredits}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">Productos vendidos</dt>
              <dd className="font-medium tabular-nums">{closure.productsSold}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">Clientes sin pagar</dt>
              <dd className="font-medium tabular-nums text-destructive">{closure.unpaidCount}</dd>
            </div>
          </dl>
        </div>

        {/* Clientes sin pagar: del snapshot congelado, nunca recalculado. */}
        <div className="flex min-w-0 flex-col gap-3 rounded-lg border border-border bg-card p-6">
          <h2 className="text-caption font-semibold tracking-wide text-muted-foreground uppercase">
            Clientes sin pagar ({closure.unpaidCount})
          </h2>

          {closure.unpaidClients.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border bg-background p-8 text-center text-body-sm text-muted-foreground">
              Todos los clientes pagaron ese día.
            </p>
          ) : (
            <>
              {/* Tarjetas en móvil */}
              <div className="flex flex-col gap-3 md:hidden">
                {closure.unpaidClients.map((cliente) => (
                  <UnpaidClientCard key={cliente.clienteId} cliente={cliente} />
                ))}
              </div>

              {/* Tabla desde md */}
              <div className="hidden overflow-hidden rounded-lg border border-border md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Teléfono</TableHead>
                      <TableHead>Cuota pendiente</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {closure.unpaidClients.map((cliente) => (
                      <TableRow key={cliente.clienteId}>
                        <TableCell className="font-medium">{cliente.nombre}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatPhone(cliente.telefono) || "—"}
                        </TableCell>
                        <TableCell className="font-semibold tabular-nums text-destructive">
                          {formatCurrency(cliente.saldoPendiente)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end">
                            <ClientActions cliente={cliente} />
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

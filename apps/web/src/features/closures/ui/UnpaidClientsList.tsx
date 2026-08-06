"use client";

import { PhoneIcon } from "lucide-react";
import type { UnpaidClient } from "@repo/types";

import { buildWhatsAppUrl } from "@/entities/receipt";
import { getInitials } from "@/shared/lib/initials";
import { formatCurrency } from "@/shared/lib/format-currency";
import { formatPhone, toDialableE164 } from "@/shared/lib/phone";
import { Button } from "@/shared/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/tooltip";
import { WhatsAppIcon } from "@/shared/ui/icons/whatsapp-icon";

import { buildPaymentReminderText } from "../lib/build-reminder-text";

// Extraído de `ClosureDetailScreen` para que `AdminCloseRouteScreen` (mismo
// shape de dato, `UnpaidClient[]` — preview y detalle comparten schema) lo
// reuse sin duplicar el markup. Tarjetas en móvil, tabla desde `md`.

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

export function UnpaidClientsList({ clients }: { clients: UnpaidClient[] }) {
  return (
    <>
      {/* Tarjetas en móvil */}
      <div className="flex flex-col gap-3 md:hidden">
        {clients.map((cliente) => (
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
            {clients.map((cliente) => (
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
  );
}

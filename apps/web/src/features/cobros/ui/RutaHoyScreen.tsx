"use client";

import Link from "next/link";
import { CheckCircle2Icon, MapPinIcon, PlusIcon, UsersIcon } from "lucide-react";

import { ESTADO_CLIENTE_LABEL_SHORT, getInitials } from "@/entities/client";
import { formatCurrency } from "@/shared/lib/format-currency";
import { cn } from "@/shared/lib/utils";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Skeleton } from "@/shared/ui/skeleton";

import { useRutaHoy } from "../api/use-cobros";

// DESIGN_SYSTEM.md §3.5 — Mi ruta de hoy (#15c). Header con el nombre de la
// ruta activa + botón "Cerrar ruta" (placeholder Fase 5). Lista de Client
// cards ordenadas: pendientes primero, ya cobrados atenuados (no ocultos).
// Empty state si el cobrador no tiene clientes asignados.

export function RutaHoyScreen() {
  const { data: items, isLoading } = useRutaHoy();

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3 p-4">
        <Header total={0} cobrados={0} rutaNombre="" />
        <div className="flex flex-col gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      </div>
    );
  }

  const ruta = items?.[0]?.ruta?.nombre ?? "Sin ruta";
  const pendientes = (items ?? []).filter((c) => !c.cobroDelDia);
  const cobrados = (items ?? []).filter((c) => Boolean(c.cobroDelDia));

  if ((items ?? []).length === 0) {
    return (
      <div className="flex flex-col gap-3 p-4">
        <Header total={0} cobrados={0} rutaNombre={ruta} />
        <EmptyState />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <Header
        total={pendientes.length + cobrados.length}
        cobrados={cobrados.length}
        rutaNombre={ruta}
      />

      {pendientes.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-caption text-muted-foreground uppercase">
            Pendientes ({pendientes.length})
          </h2>
          {pendientes.map((c) => (
            <ClienteRowLink key={c.id} cliente={c} />
          ))}
        </section>
      ) : null}

      {cobrados.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-caption text-muted-foreground uppercase">
            Cobrados hoy ({cobrados.length})
          </h2>
          {cobrados.map((c) => (
            <ClienteRowLink key={c.id} cliente={c} cobrado />
          ))}
        </section>
      ) : null}

      <div className="flex gap-3">
        <Button asChild variant="secondary" className="flex-1">
          <Link href="/collector/clients/new">
            <PlusIcon />
            Nuevo cliente
          </Link>
        </Button>
      </div>
    </div>
  );
}

function Header({
  total,
  cobrados,
  rutaNombre,
}: {
  total: number;
  cobrados: number;
  rutaNombre: string;
}) {
  return (
    <header className="flex items-center justify-between gap-3 rounded-lg bg-card p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <MapPinIcon className="size-5" />
        </span>
        <div className="flex min-w-0 flex-col">
          <span className="text-caption text-muted-foreground uppercase">
            Mi ruta de hoy
          </span>
          <span className="truncate text-h3 font-semibold">{rutaNombre}</span>
        </div>
      </div>
      <div className="flex flex-col items-end">
        <span className="text-h2 font-semibold tabular-nums">{total - cobrados}</span>
        <span className="text-caption text-muted-foreground">pendientes</span>
      </div>
    </header>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border bg-card p-10 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <UsersIcon className="size-6" />
      </span>
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium">No tienes clientes asignados a esta ruta todavía</p>
        <p className="text-caption text-muted-foreground">
          Cuando tu admin te asigne clientes aparecerán aquí automáticamente.
        </p>
      </div>
    </div>
  );
}

function ClienteRowLink({
  cliente,
  cobrado,
}: {
  cliente: import("@repo/types").ClienteListItem & {
    creditos: import("@repo/types").CreditoListItem[];
    cobroDelDia?: { creditoId: string; monto: number; fecha: string };
  };
  cobrado?: boolean;
}) {
  const creditoPrincipal =
    cliente.creditos.find((c) => c.estado === "ACTIVO" || c.estado === "MORA") ??
    cliente.creditos[0] ??
    null;

  return (
    <Link
      href={`/collector/clients/${cliente.id}`}
      className={cn(
        "flex items-center gap-3 rounded-lg border border-border bg-card p-3 transition-colors",
        cobrado && "opacity-60",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      )}
      aria-label={`Abrir cliente ${cliente.nombre}`}
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-semibold">
        {getInitials(cliente.nombre)}
      </span>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-medium">{cliente.nombre}</span>
        <span className="truncate text-caption text-muted-foreground">
          {creditoPrincipal
            ? `${creditoPrincipal.producto.nombre} · ${formatCurrency(creditoPrincipal.saldoPendiente)}`
            : "Sin crédito activo"}
        </span>
      </div>
      {cobrado ? (
        <Badge status="pagado">
          <CheckCircle2Icon className="size-3" />
          Cobrado
        </Badge>
      ) : cliente.estado ? (
        <Badge status={cliente.estado}>{ESTADO_CLIENTE_LABEL_SHORT[cliente.estado]}</Badge>
      ) : null}
    </Link>
  );
}

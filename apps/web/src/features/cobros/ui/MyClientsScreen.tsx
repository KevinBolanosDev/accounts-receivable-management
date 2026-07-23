"use client";

import Link from "next/link";
import { PlusIcon } from "lucide-react";
import type { ClienteListItem } from "@repo/types";

import { ESTADO_CLIENTE_LABEL } from "@/entities/client";
import { useClientes, useClientesSummary } from "@/features/clients/api/use-clientes";
import { getInitials } from "@/shared/lib/initials";
import { formatCurrency } from "@/shared/lib/format-currency";
import { cn } from "@/shared/lib/utils";
import { Badge } from "@/shared/ui/badge";
import { ProgressRing } from "@/shared/ui/progress-ring";
import { Skeleton } from "@/shared/ui/skeleton";
import { CollectorHero } from "@/widgets/collector-shell/CollectorHero";

// Vista "Clientes" del Cobrador (§7 — cierre de Fase 3). A diferencia de
// "Mis rutas" (agrupado por ruta), aquí aparecen TODOS los clientes del
// cobrador en una sola lista, con una tira de métricas arriba (clientes /
// total cartera / cobrados / saldo). Reusa `useClientes()` — el mismo hook
// real que el Admin (3c), ya scoped por cobrador en el backend — y el nuevo
// `useClientesSummary()` (`GET /clients/summary`) para las métricas
// agregadas, que no se pueden derivar de la lista (no trae montoTotal).

export function MyClientsScreen() {
  const { data: clientes, isLoading } = useClientes();
  const { data: summary } = useClientesSummary();

  return (
    <div className="flex flex-col pb-6">
      <CollectorHero
        title="Clientes"
        subtitle={`${summary?.clientes ?? clientes?.length ?? 0} cliente${
          (summary?.clientes ?? clientes?.length ?? 0) === 1 ? "" : "s"
        } en tus rutas`}
        actions={
          <Link
            href="/collector/clients/new"
            aria-label="Nuevo cliente"
            className="flex size-9 items-center justify-center rounded-full text-primary-foreground hover:bg-white/10"
          >
            <PlusIcon className="size-5" />
          </Link>
        }
      />

      {/* Tira de métricas superpuesta al hero. */}
      <div className="relative z-10 -mt-9 px-4">
        <div className="grid grid-cols-2 gap-3 rounded-xl border border-border bg-card p-4 shadow-md">
          <MetricTile label="Clientes" value={String(summary?.clientes ?? "—")} />
          <MetricTile
            label="Total cartera"
            value={summary ? formatCurrency(summary.cartera) : "—"}
          />
          <MetricTile label="Cobrados" value={summary ? formatCurrency(summary.cobrados) : "—"} />
          <MetricTile label="Saldo" value={summary ? formatCurrency(summary.saldo) : "—"} />
        </div>
      </div>

      <div className="flex flex-col gap-3 px-4 pt-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-18 w-full rounded-xl" />
          ))
        ) : (clientes ?? []).length === 0 ? (
          <div className="flex flex-col items-center gap-1 rounded-xl border border-dashed border-border bg-card p-8 text-center">
            <p className="text-sm font-medium">No tienes clientes asignados todavía</p>
            <p className="text-caption text-muted-foreground">
              Cuando tu admin te asigne clientes aparecerán aquí automáticamente.
            </p>
          </div>
        ) : (
          (clientes ?? []).map((cliente) => <ClienteCard key={cliente.id} cliente={cliente} />)
        )}
      </div>
    </div>
  );
}

function MetricTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-caption uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="text-base font-bold tabular-nums">{value}</span>
    </div>
  );
}

function ClienteCard({ cliente }: { cliente: ClienteListItem }) {
  return (
    <Link
      href={`/collector/routes/payments/${cliente.id}`}
      aria-label={`Abrir cliente ${cliente.nombre}`}
      className={cn(
        "flex items-center gap-3 rounded-xl border border-border bg-card p-3.5 shadow-sm transition-colors",
        "hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      )}
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
        {getInitials(cliente.nombre)}
      </span>

      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-semibold">{cliente.nombre}</span>
        <span className="truncate text-caption text-muted-foreground">
          {cliente.ruta?.nombre ?? "Sin ruta"}
        </span>
      </div>

      <div className="flex shrink-0 flex-col items-end gap-1">
        <span className="text-sm font-bold tabular-nums">
          {formatCurrency(cliente.saldoPendiente ?? 0)}
        </span>
        {cliente.estado ? (
          <Badge status={cliente.estado}>{ESTADO_CLIENTE_LABEL[cliente.estado]}</Badge>
        ) : null}
      </div>

      <ProgressRing value={cliente.porcentajePagado ?? 0} size="mini" />
    </Link>
  );
}

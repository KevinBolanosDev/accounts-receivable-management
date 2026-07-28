"use client";

import Link from "next/link";
import { PlusIcon } from "lucide-react";
import type { ClienteListItem } from "@repo/types";

import { ClientCard, ESTADO_CLIENTE_LABEL } from "@/entities/client";
import { useClientes, useClientesSummary } from "@/features/clients/api/use-clientes";
import { formatCurrency } from "@/shared/lib/format-currency";
import { Badge } from "@/shared/ui/badge";
import { MetricTile, MetricTileGroup } from "@/shared/ui/metric-tile";
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
      <div className="px-4">
        <MetricTileGroup columns={2} overlap className="gap-3">
          <MetricTile label="Clientes" value={String(summary?.clientes ?? "—")} align="start" />
          <MetricTile
            label="Total cartera"
            value={summary ? formatCurrency(summary.cartera) : "—"}
            align="start"
          />
          <MetricTile
            label="Cobrados"
            value={summary ? formatCurrency(summary.cobrados) : "—"}
            align="start"
          />
          <MetricTile
            label="Saldo"
            value={summary ? formatCurrency(summary.saldo) : "—"}
            align="start"
          />
        </MetricTileGroup>
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

function ClienteCard({ cliente }: { cliente: ClienteListItem }) {
  return (
    <ClientCard
      cliente={cliente}
      href={`/collector/routes/payments/${cliente.id}`}
      // Acá SÍ se muestra la ruta: esta lista mezcla clientes de todas las
      // rutas del cobrador, así que saber a cuál pertenece cada uno es útil.
      contacto={{ documento: cliente.documento, telefono: cliente.telefono }}
      subtitle={cliente.ruta?.nombre}
      amount={cliente.saldoPendiente ?? 0}
      amountLabel="saldo"
      badge={
        cliente.estado ? (
          <Badge status={cliente.estado}>{ESTADO_CLIENTE_LABEL[cliente.estado]}</Badge>
        ) : null
      }
      porcentajePagado={cliente.porcentajePagado ?? 0}
      className="shadow-sm"
    />
  );
}

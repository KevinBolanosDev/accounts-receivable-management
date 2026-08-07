"use client";

import Link from "next/link";
import { ChevronRightIcon, MapPinIcon } from "lucide-react";

import { useSessionStore } from "@/entities/session";
import { useRutas, useRutasSummary } from "@/features/routes-collectors/api/use-rutas";
import { formatCurrency } from "@/shared/lib/format-currency";
import { formatDateShort } from "@/shared/lib/format-date";
import { PRESS_SCALE, useStagger } from "@/shared/lib/motion";
import { cn } from "@/shared/lib/utils";
import { MetricTile, MetricTileGroup } from "@/shared/ui/metric-tile";
import { ProgressRing } from "@/shared/ui/progress-ring";
import { CountUpValue } from "@/shared/ui/count-up-value";
import { EmptyState } from "@/shared/ui/empty-state";
import { Skeleton } from "@/shared/ui/skeleton";
import { CollectorHero } from "@/widgets/collector-shell/CollectorHero";

// DESIGN_SYSTEM.md §3.5 — Mis rutas (raíz del portal cobrador). Un cobrador
// puede tener VARIAS rutas: esta pantalla las lista con el resumen del día
// (clientes, avance y cobrado hoy) y cada tarjeta abre el detalle de ruta
// (/collector/routes/[id], screenshot 15c). Reusa `useRutas()` — el mismo
// hook real que usa el Admin (6c), ya scoped por cobrador en el backend
// (`GET /routes` con `cobradorId = user.sub` para rol COBRADOR). La tira de
// métricas arriba (§7 — cierre de Fase 3) reusa `useRutasSummary()`, ya
// existente y consumido por el Admin.

export function MyRoutesScreen() {
  const usuario = useSessionStore((state) => state.usuario);
  const { data: rutas, isLoading } = useRutas();
  const { data: summary } = useRutasSummary();
  // Entrada en stagger corto, solo en el primer montaje (§1.8).
  const listRef = useStagger<HTMLDivElement>(".route-card");

  return (
    <div className="flex flex-col pb-6">
      <CollectorHero
        title="Mis rutas"
        subtitle={`${usuario?.nombre ?? "Cobrador"} · hoy, ${formatDateShort(new Date())}`}
      />

      {/* Tira de métricas superpuesta al hero. */}
      <div className="px-4">
        <MetricTileGroup columns={3} divided overlap>
          <MetricTile
            value={summary ? `${summary.rutasAbiertas}/${summary.rutasTotal}` : "—"}
            label="Rutas abiertas"
          />
          <MetricTile
            value={
              summary ? (
                <CountUpValue value={summary.cobradoHoy} format={formatCurrency} />
              ) : (
                "—"
              )
            }
            label="Cobrado hoy"
          />
          <MetricTile value={summary ? String(summary.clientesEnRuta) : "—"} label="Clientes" />
        </MetricTileGroup>
      </div>

      <div ref={listRef} className="flex flex-col gap-3 px-4 pt-4">
        {isLoading ? (
          Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-21 w-full rounded-xl" />
          ))
        ) : (rutas ?? []).length === 0 ? (
          <EmptyState
            icon={<MapPinIcon />}
            title="No tienes rutas asignadas todavía"
            description="Cuando tu admin te asigne una ruta aparecerá acá automáticamente."
          />
        ) : (
          (rutas ?? []).map((ruta) => (
            <Link
              key={ruta.id}
              href={`/collector/routes/${ruta.id}`}
              aria-label={`Abrir ${ruta.nombre}`}
              className={cn(
                "route-card flex items-center gap-3 rounded-xl border border-border bg-card p-4 shadow-sm transition-colors",
                "hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                PRESS_SCALE,
              )}
            >
              <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary-strong">
                <MapPinIcon className="size-5" />
              </span>

              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate text-sm font-semibold">{ruta.nombre}</span>
                <span className="truncate text-caption text-muted-foreground">
                  {ruta.clientesCount} cliente{ruta.clientesCount === 1 ? "" : "s"}
                </span>
              </div>

              <div className="flex shrink-0 flex-col items-end gap-0.5">
                <span className="text-sm font-bold tabular-nums">
                  {formatCurrency(ruta.totalCobradoHoy)}
                </span>
                <span className="text-caption text-muted-foreground">cobrado hoy</span>
              </div>

              <ProgressRing value={ruta.avanceDelDia} size="mini" />
              <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" />
            </Link>
          ))
        )}
      </div>
    </div>
  );
}


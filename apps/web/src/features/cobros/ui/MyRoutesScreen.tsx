"use client";

import Link from "next/link";
import { ChevronRightIcon, MapPinIcon } from "lucide-react";

import { useSessionStore } from "@/entities/session";
import { useRutas } from "@/features/routes-collectors/api/use-rutas";
import { formatCurrency } from "@/shared/lib/format-currency";
import { cn } from "@/shared/lib/utils";
import { ProgressRing } from "@/shared/ui/progress-ring";
import { Skeleton } from "@/shared/ui/skeleton";
import { CollectorHero } from "@/widgets/collector-shell/CollectorHero";

// DESIGN_SYSTEM.md §3.5 — Mis rutas (raíz del portal cobrador). Un cobrador
// puede tener VARIAS rutas: esta pantalla las lista con el resumen del día
// (clientes, avance y cobrado hoy) y cada tarjeta abre el detalle de ruta
// (/collector/routes/[id], screenshot 15c). Reusa `useRutas()` — el mismo
// hook real que usa el Admin (6c), ya scoped por cobrador en el backend
// (`GET /routes` con `cobradorId = user.sub` para rol COBRADOR).

export function MyRoutesScreen() {
  const usuario = useSessionStore((state) => state.usuario);
  const { data: rutas, isLoading } = useRutas();

  return (
    <div className="flex flex-col pb-6">
      <CollectorHero
        title="Mis rutas"
        subtitle={`${usuario?.nombre ?? "Cobrador"} · hoy, ${fechaHoyCorta()}`}
      />

      <div className="-mt-9 flex flex-col gap-3 px-4 z-10">
        {isLoading ? (
          Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-21 w-full rounded-xl" />
          ))
        ) : (rutas ?? []).length === 0 ? (
          <div className="flex flex-col items-center gap-1 rounded-xl border border-dashed border-border bg-card p-8 text-center">
            <p className="text-sm font-medium">No tienes rutas asignadas todavía</p>
            <p className="text-caption text-muted-foreground">
              Cuando tu admin te asigne una ruta aparecerá aquí automáticamente.
            </p>
          </div>
        ) : (
          (rutas ?? []).map((ruta) => (
            <Link
              key={ruta.id}
              href={`/collector/routes/${ruta.id}`}
              aria-label={`Abrir ${ruta.nombre}`}
              className={cn(
                "flex items-center gap-3 rounded-xl border border-border bg-card p-4 shadow-sm transition-colors",
                "hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              )}
            >
              <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
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

function fechaHoyCorta(): string {
  return new Date().toLocaleDateString("es-CO", { day: "numeric", month: "short" });
}

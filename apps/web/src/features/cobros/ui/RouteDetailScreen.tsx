"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { CheckIcon } from "lucide-react";
import { toast } from "sonner";
import type { RutaDetail } from "@repo/types";

import { ESTADO_CLIENTE_LABEL } from "@/entities/client";
import { useRuta } from "@/features/routes-collectors/api/use-rutas";
import { getInitials } from "@/shared/lib/initials";
import { formatCurrency } from "@/shared/lib/format-currency";
import { cn } from "@/shared/lib/utils";
import { Badge } from "@/shared/ui/badge";
import { ProgressRing } from "@/shared/ui/progress-ring";
import { Skeleton } from "@/shared/ui/skeleton";
import { CollectorHero } from "@/widgets/collector-shell/CollectorHero";

// DESIGN_SYSTEM.md §3.5 — Detalle de ruta (#15c). Hero de marca (CollectorHero)
// con "Cerrar ruta" (stub Fase 5) + tarjeta resumen superpuesta
// (Pendientes / Cobrados / Hoy) + lista de clientes: pendientes primero y la
// sección "Cobrados hoy" atenuada (no oculta). Cada tarjeta lleva avatar,
// nombre + ruta, saldo + badge de estado y el anillo de avance. Reusa
// `useRuta(id)` — el mismo hook real que el Admin (8c); el backend ya
// calcula `clientes[].cobroHoy` a partir de los Pagos del día.

export function RouteDetailScreen() {
  const params = useParams<{ id: string }>();
  const routeId = params.id;
  const { data: ruta, isLoading } = useRuta(routeId);

  if (isLoading || !ruta) {
    return (
      <div className="flex flex-col pb-6">
        <CollectorHero title="Detalle de ruta" backHref="/collector" />
        <div className="-mt-9 flex flex-col gap-3 px-4">
          <Skeleton className="h-19 w-full rounded-xl" />
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-19 w-full rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  const pendientes = ruta.clientes.filter((c) => !c.cobroHoy);
  const cobrados = ruta.clientes.filter((c) => Boolean(c.cobroHoy));

  return (
    <div className="flex flex-col pb-6">
      <CollectorHero
        title={ruta.nombre}
        subtitle={`${ruta.cobrador?.nombre ?? "Sin cobrador"} · hoy, ${fechaHoyCorta()}`}
        backHref="/collector"
        actions={
          <button
            type="button"
            onClick={() =>
              toast.info("El cierre de ruta llega con el cierre diario (Fase 5).")
            }
            className={cn(
              "rounded-full border border-white/40 px-3.5 py-1.5 text-sm font-medium text-primary-foreground",
              "transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60",
            )}
          >
            Cerrar ruta
          </button>
        }
      />

      {/* Tarjeta de resumen superpuesta al hero (screenshot 15c). */}
      <div className="relative -mt-9 px-4">
        <div className="grid grid-cols-3 divide-x divide-border rounded-xl border border-border bg-card shadow-md">
          <SummaryStat value={String(pendientes.length)} label="Pendientes" />
          <SummaryStat value={String(cobrados.length)} label="Cobrados" />
          <SummaryStat value={formatCurrency(ruta.cobradoHoy)} label="Hoy" />
        </div>
      </div>

      <div className="flex flex-col gap-3 px-4 pt-4">
        {ruta.clientes.length === 0 ? (
          <div className="flex flex-col items-center gap-1 rounded-xl border border-dashed border-border bg-card p-8 text-center">
            <p className="text-sm font-medium">No tienes clientes asignados a esta ruta todavía</p>
            <p className="text-caption text-muted-foreground">
              Cuando tu admin te asigne clientes aparecerán aquí automáticamente.
            </p>
          </div>
        ) : null}

        {pendientes.map((cliente) => (
          <ClienteCard key={cliente.id} cliente={cliente} />
        ))}

        {cobrados.length > 0 ? (
          <>
            <h2 className="pt-2 text-caption font-semibold uppercase tracking-wide text-muted-foreground">
              Cobrados hoy
            </h2>
            {cobrados.map((cliente) => (
              <ClienteCard key={cliente.id} cliente={cliente} cobrado />
            ))}
          </>
        ) : null}
      </div>
    </div>
  );
}

function SummaryStat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-0.5 px-2 py-3.5">
      <span className="text-lg font-bold tabular-nums">{value}</span>
      <span className="text-caption text-muted-foreground">{label}</span>
    </div>
  );
}

function ClienteCard({
  cliente,
  cobrado,
}: {
  cliente: RutaDetail["clientes"][number];
  cobrado?: boolean;
}) {
  return (
    <Link
      href={`/collector/routes/payments/${cliente.id}`}
      aria-label={`Abrir cliente ${cliente.nombre}`}
      className={cn(
        "flex items-center gap-3 rounded-xl border border-border bg-card p-3.5 shadow-sm transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        cobrado && "opacity-60",
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
        {cobrado ? (
          <Badge status="pagado">
            <CheckIcon />
            Cobrado
          </Badge>
        ) : cliente.estado ? (
          <Badge status={cliente.estado}>{ESTADO_CLIENTE_LABEL[cliente.estado]}</Badge>
        ) : null}
      </div>

      <ProgressRing value={cliente.porcentajePagado ?? 0} size="mini" />
    </Link>
  );
}

function fechaHoyCorta(): string {
  return new Date().toLocaleDateString("es-CO", { day: "numeric", month: "short" });
}

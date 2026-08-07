"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { CheckIcon, UsersIcon } from "lucide-react";
import type { RutaDetail } from "@repo/types";

import { ClientCard, ESTADO_CLIENTE_LABEL } from "@/entities/client";
import { useRuta } from "@/features/routes-collectors/api/use-rutas";
import { formatCurrency } from "@/shared/lib/format-currency";
import { formatDateShort } from "@/shared/lib/format-date";
import { cn } from "@/shared/lib/utils";
import { Badge } from "@/shared/ui/badge";
import { MetricTile, MetricTileGroup } from "@/shared/ui/metric-tile";
import { EmptyState } from "@/shared/ui/empty-state";
import { Skeleton } from "@/shared/ui/skeleton";
import { CollectorHero } from "@/widgets/collector-shell/CollectorHero";

// DESIGN_SYSTEM.md §3.5 — Detalle de ruta (#15c). Hero de marca (CollectorHero)
// con "Cerrar ruta" (enlaza a #19c, `features/closures`) + tarjeta resumen
// superpuesta (Pendientes / Cobrados / Hoy) + lista de clientes: pendientes
// primero y la sección "Cobrados hoy" atenuada (no oculta). Cada tarjeta
// lleva avatar, nombre + ruta, saldo + badge de estado y el anillo de avance.
// Reusa `useRuta(id)` — el mismo hook real que el Admin (8c); el backend ya
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
        subtitle={`${ruta.cobrador?.nombre ?? "Sin cobrador"} · hoy, ${formatDateShort(new Date())}`}
        backHref="/collector"
        actions={
          <Link
            href={`/collector/routes/${routeId}/close`}
            className={cn(
              "rounded-full border border-white/40 px-3.5 py-1.5 text-sm font-medium text-primary-foreground",
              "transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60",
            )}
          >
            Cerrar ruta
          </Link>
        }
      />

      {/* Tarjeta de resumen superpuesta al hero (screenshot 15c). */}
      <div className="px-4">
        <MetricTileGroup columns={3} divided overlap>
          <MetricTile value={String(pendientes.length)} label="Pendientes" />
          <MetricTile value={String(cobrados.length)} label="Cobrados" tone="success" />
          <MetricTile value={formatCurrency(ruta.cobradoHoy)} label="Cobrado hoy" />
        </MetricTileGroup>
      </div>

      <div className="flex flex-col gap-3 px-4 pt-4">
        {ruta.clientes.length === 0 ? (
          <EmptyState
            icon={<UsersIcon />}
            title="Esta ruta todavía no tiene clientes"
            description="Cuando tu admin te asigne clientes aparecerán acá automáticamente."
          />
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

function ClienteCard({
  cliente,
  cobrado,
}: {
  cliente: RutaDetail["clientes"][number];
  cobrado?: boolean;
}) {
  return (
    <ClientCard
      cliente={cliente}
      href={`/collector/routes/payments/${cliente.id}`}
      // Dentro del detalle de UNA ruta el nombre de esa ruta es redundante; lo
      // útil parado en la puerta es el documento y el teléfono, copiables.
      contacto={{ documento: cliente.documento, telefono: cliente.telefono }}
      // Ya cobrado ⇒ interesa CUÁNTO se cobró hoy (suma de todos sus abonos del
      // día). Pendiente ⇒ interesa cuánto falta. Antes ambos casos mostraban el
      // saldo pendiente, así que la tarjeta "Cobrado" repetía el mismo número
      // que el hero y no decía nada de la cobranza del día.
      amount={cobrado ? (cliente.totalCobradoHoy ?? cliente.cobroHoy?.monto ?? 0) : (cliente.saldoPendiente ?? 0)}
      amountLabel={cobrado ? "cobrado hoy" : "saldo"}
      badge={
        cobrado ? (
          <Badge status="pagado">
            <CheckIcon />
            Cobrado
          </Badge>
        ) : cliente.estado ? (
          <Badge status={cliente.estado}>{ESTADO_CLIENTE_LABEL[cliente.estado]}</Badge>
        ) : null
      }
      porcentajePagado={cliente.porcentajePagado ?? 0}
      muted={cobrado}
      className="shadow-sm"
    />
  );
}

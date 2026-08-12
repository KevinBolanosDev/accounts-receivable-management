"use client";

import Link from "next/link";
import { BanknoteIcon, CreditCardIcon, MapPinIcon, TriangleAlertIcon } from "lucide-react";
import type { DashboardRoute } from "@repo/types";

import { formatCurrency } from "@/shared/lib/format-currency";
import { formatDate } from "@/shared/lib/format-date";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { CountUpValue } from "@/shared/ui/count-up-value";
import { EmptyState } from "@/shared/ui/empty-state";
import { MetricCard } from "@/shared/ui/metric-card";
import { MetricTile, MetricTileGroup } from "@/shared/ui/metric-tile";
import { ProgressRing } from "@/shared/ui/progress-ring";
import { Skeleton } from "@/shared/ui/skeleton";
import { AdminPageHeader } from "@/widgets/admin-shell/AdminPageHeader";

import { useDashboardSummary } from "../api/use-dashboard";
import { WeeklyChart } from "./WeeklyChart";

function RouteMiniCard({ ruta }: { ruta: DashboardRoute }) {
  return (
    <Link
      href={`/admin/routes-collectors/${ruta.id}`}
      className="flex items-center gap-3 rounded-lg border border-border bg-card p-4 transition-colors hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      <ProgressRing value={ruta.avanceDelDia} size="mini" />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-medium">{ruta.nombre}</span>
        <span className="truncate text-caption text-muted-foreground tabular-nums">
          {formatCurrency(ruta.totalCobradoHoy)}
        </span>
      </div>
      <Badge status={ruta.estadoDia === "abierta" ? "ruta-abierta" : "ruta-cerrada"}>
        {ruta.estadoDia === "abierta" ? "Abierta" : "Cerrada"}
      </Badge>
    </Link>
  );
}

function DashboardSkeleton() {
  return (
    <>
      <AdminPageHeader title="Dashboard" />
      <div className="flex flex-col gap-6 p-4 sm:p-6">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    </>
  );
}

// DESIGN_SYSTEM.md §3.2 — Dashboard del Admin (#2b): metric cards → rutas del
// día → gráfico semanal. Reemplaza el placeholder de `/admin`.
export function DashboardScreen() {
  const { data: summary, isLoading } = useDashboardSummary();

  if (isLoading || !summary) return <DashboardSkeleton />;

  const hasActivity =
    summary.totalCollectedToday > 0 ||
    summary.routesToday.some((r) => r.totalCobradoHoy > 0) ||
    summary.weeklyCollections.some((p) => p.total > 0);

  const today = formatDate(new Date());
  const totalRoutesToday = summary.routesToday.length;

  return (
    <>
      <AdminPageHeader title="Dashboard" subtitle={today} />

      <div className="flex flex-col gap-6 p-4 sm:p-6">
        {!hasActivity ? (
          <EmptyState
            icon={<BanknoteIcon />}
            title="Aún no hay actividad registrada"
            description="Cuando se registren cobros y cierres, las métricas aparecen acá."
            action={
              <Button asChild size="sm" variant="secondary">
                <Link href="/admin/routes-collectors">Ver rutas</Link>
              </Button>
            }
          />
        ) : (
          <>
            {/* Resumen compacto en móvil, 4 tiles */}
            <MetricTileGroup columns={4} divided className="sm:hidden">
              <MetricTile
                value={<CountUpValue value={summary.totalCollectedToday} format={formatCurrency} />}
                label="Cobrado hoy"
              />
              <MetricTile
                value={<CountUpValue value={summary.activeCredits} />}
                label="Créditos activos"
              />
              <MetricTile
                value={<CountUpValue value={summary.clientsInArrears} />}
                label="En mora"
                tone="destructive"
              />
              <MetricTile
                value={<CountUpValue value={summary.openRoutes} />}
                label="Rutas abiertas"
                sub={`de ${totalRoutesToday}`}
              />
            </MetricTileGroup>

            {/* Metric cards desde sm */}
            <div className="hidden gap-4 sm:grid sm:grid-cols-2 lg:grid-cols-4">
              <MetricCard
                tone="primary"
                icon={<BanknoteIcon />}
                label="Cobrado hoy"
                value={<CountUpValue value={summary.totalCollectedToday} format={formatCurrency} />}
              />
              <MetricCard
                tone="accent"
                icon={<CreditCardIcon />}
                label="Créditos activos"
                value={<CountUpValue value={summary.activeCredits} />}
              />
              <MetricCard
                tone="destructive"
                icon={<TriangleAlertIcon />}
                label="Clientes en mora"
                value={<CountUpValue value={summary.clientsInArrears} />}
              />
              <MetricCard
                tone="success"
                icon={<MapPinIcon />}
                label="Rutas abiertas"
                value={<CountUpValue value={summary.openRoutes} />}
                sub={`de ${totalRoutesToday}`}
              />
            </div>

            {/* Rutas del día */}
            <section className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h2 className="text-h3 font-semibold">Rutas del día</h2>
                <Link href="/admin/routes-collectors" className="text-body-sm font-medium text-accent-strong hover:underline">
                  Ver todas
                </Link>
              </div>
              {totalRoutesToday === 0 ? (
                <EmptyState
                  size="inline"
                  icon={<MapPinIcon />}
                  title="Ninguna ruta tiene actividad hoy"
                  description="Los cobros del día aparecen acá apenas se registren."
                />
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {summary.routesToday.map((ruta) => (
                    <RouteMiniCard key={ruta.id} ruta={ruta} />
                  ))}
                </div>
              )}
            </section>

            {/* Gráfico semanal */}
            <section className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 sm:p-6">
              <h2 className="text-h3 font-semibold">Cobros de la semana</h2>
              <WeeklyChart data={summary.weeklyCollections} />
            </section>
          </>
        )}
      </div>
    </>
  );
}

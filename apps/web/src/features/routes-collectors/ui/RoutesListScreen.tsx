"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { BanknoteIcon, MapPinIcon, PlusIcon, UserIcon } from "lucide-react";
import type { RutaListItem } from "@repo/types";

import { formatCurrency } from "@/shared/lib/format-currency";
import { cn } from "@/shared/lib/utils";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { MetricCard } from "@/shared/ui/metric-card";
import { MetricTile, MetricTileGroup } from "@/shared/ui/metric-tile";
import { ProgressBar } from "@/shared/ui/progress-bar";
import { Skeleton } from "@/shared/ui/skeleton";
import { Switch } from "@/shared/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/tooltip";
import { AdminPageHeader, HEADER_ACTION_CLASS } from "@/widgets/admin-shell/AdminPageHeader";

import { useRutas, useRutasSummary, useUpdateRuta } from "../api/use-rutas";

function avanceColor(value: number): string {
  if (value >= 100) return "text-success";
  if (value < 50) return "text-warning";
  return "text-accent";
}

// Tarjeta de ruta en móvil (#m6): nombre + estado del día, cobrador y
// clientes, barra de avance degradada, y al pie lo cobrado hoy con el % del
// día. El Switch "ruta activa" NO baja a la tarjeta: es una acción destructiva
// de bajo contraste visual, y en una lista táctil se dispara sin querer. Se
// queda en la tabla de escritorio y en el detalle de la ruta.
function RutaCard({ ruta }: { ruta: RutaListItem }) {
  const sinAbrir = ruta.totalCobradoHoy === 0 && ruta.estadoDia === "cerrada";

  return (
    <Link
      href={`/admin/routes-collectors/${ruta.id}`}
      className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 transition-colors hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-sm font-semibold">{ruta.nombre}</span>
          <span className="truncate text-caption text-muted-foreground">
            {/* Sin cobrador no es "sin asignar": es una ruta que cobra el admin
                (el criterio que separa los dos grupos de esta pantalla). */}
            {ruta.cobrador?.nombre ?? "Ruta propia"} · {ruta.clientesCount}{" "}
            {ruta.clientesCount === 1 ? "cliente" : "clientes"}
          </span>
        </div>
        <Badge status={ruta.estadoDia === "abierta" ? "ruta-abierta" : "ruta-cerrada"}>
          {ruta.estadoDia === "abierta" ? "Abierta" : "Cerrada"}
        </Badge>
      </div>

      <ProgressBar value={ruta.avanceDelDia} tone="gradient" />

      <div className="flex items-baseline justify-between gap-3 text-caption">
        <span className="truncate text-muted-foreground">
          Cobrado hoy{" "}
          <span className="font-semibold text-foreground tabular-nums">
            {sinAbrir ? "Sin abrir" : formatCurrency(ruta.totalCobradoHoy)}
          </span>
        </span>
        <span className={cn("shrink-0 font-medium tabular-nums", avanceColor(ruta.avanceDelDia))}>
          {ruta.avanceDelDia}% del día
        </span>
      </div>
    </Link>
  );
}

function RutaRow({ ruta, showCobrador = true }: { ruta: RutaListItem; showCobrador?: boolean }) {
  const router = useRouter();
  const updateRuta = useUpdateRuta(ruta.id);
  const sinAbrir = ruta.totalCobradoHoy === 0 && ruta.estadoDia === "cerrada";

  return (
    <TableRow
      className="cursor-pointer"
      onClick={() => router.push(`/admin/routes-collectors/${ruta.id}`)}
    >
      <TableCell className="font-medium">{ruta.nombre}</TableCell>
      {showCobrador ? (
        <TableCell className="text-muted-foreground">
          {ruta.cobrador?.nombre ?? "Sin asignar"}
        </TableCell>
      ) : null}
      <TableCell className="tabular-nums">{ruta.clientesCount}</TableCell>
      <TableCell className="tabular-nums">
        {sinAbrir ? (
          <span className="text-muted-foreground">Sin abrir</span>
        ) : (
          formatCurrency(ruta.totalCobradoHoy)
        )}
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-3">
          <ProgressBar value={ruta.avanceDelDia} className="w-24" />
          <span className={cn("w-9 text-right text-sm font-medium tabular-nums", avanceColor(ruta.avanceDelDia))}>
            {ruta.avanceDelDia}%
          </span>
        </div>
      </TableCell>
      <TableCell>
        <Badge status={ruta.estadoDia === "abierta" ? "ruta-abierta" : "ruta-cerrada"}>
          {ruta.estadoDia === "abierta" ? "Abierta" : "Cerrada"}
        </Badge>
      </TableCell>
      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
        <Tooltip>
          {/* Span intermedio: ver nota en CollectorsScreen — asChild directo
              sobre Switch pisa su `data-state` con el del Tooltip. */}
          <TooltipTrigger asChild>
            <span className="inline-flex">
              <Switch
                checked={ruta.activa}
                aria-label={ruta.activa ? "Desactivar ruta" : "Activar ruta"}
                onCheckedChange={(checked) => updateRuta.mutate({ activa: checked })}
              />
            </span>
          </TooltipTrigger>
          <TooltipContent>{ruta.activa ? "Desactivar ruta" : "Activar ruta"}</TooltipContent>
        </Tooltip>
      </TableCell>
    </TableRow>
  );
}

// Un grupo de la lista de rutas ("Mis rutas" / "Rutas de cobradores"): título
// con contador, tarjetas en móvil y tabla desde `md`. Es un componente y no dos
// bloques repetidos porque la lista tiene dos presentaciones responsive y
// duplicarlas garantizaba que se desincronizaran al tocar una sola.
function RutasGroup({
  title,
  hint,
  rutas,
  isLoading,
  emptyText,
  /** La columna "Cobrador" no aporta nada en un grupo donde nadie tiene uno. */
  showCobrador = true,
}: {
  title: string;
  hint: string;
  rutas: RutaListItem[];
  isLoading: boolean;
  emptyText: string;
  showCobrador?: boolean;
}) {
  const columnas = showCobrador ? 7 : 6;

  return (
    <section className="flex min-w-0 flex-col gap-3">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <h2 className="text-h3 font-semibold">
          {title}{" "}
          <span className="font-normal text-muted-foreground tabular-nums">({rutas.length})</span>
        </h2>
        <span className="text-caption text-muted-foreground">{hint}</span>
      </div>

      {!isLoading && rutas.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border bg-card p-6 text-center text-body-sm text-muted-foreground">
          {emptyText}
        </p>
      ) : (
        <>
          {/* Lista de tarjetas en móvil */}
          <div className="flex flex-col gap-3 md:hidden">
            {isLoading
              ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 w-full" />)
              : rutas.map((ruta) => <RutaCard key={ruta.id} ruta={ruta} />)}
          </div>

          {/* Tabla desde md */}
          <div className="hidden min-w-0 rounded-lg border border-border bg-card md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ruta</TableHead>
                  {showCobrador ? <TableHead>Cobrador</TableHead> : null}
                  <TableHead>Clientes</TableHead>
                  <TableHead>Cobrado hoy</TableHead>
                  <TableHead>Avance del día</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Ruta activa</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading
                  ? Array.from({ length: 3 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell colSpan={columnas}>
                          <Skeleton className="h-6 w-full" />
                        </TableCell>
                      </TableRow>
                    ))
                  : rutas.map((ruta) => (
                      <RutaRow key={ruta.id} ruta={ruta} showCobrador={showCobrador} />
                    ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </section>
  );
}

export function RoutesListScreen() {
  const { data: rutas, isLoading } = useRutas();
  const { data: summary } = useRutasSummary();

  // Dos grupos, un solo `GET /routes`: el admin ve todas las rutas de su tenant
  // y lo que las separa es tener cobrador asignado o no.
  //
  // "Mis rutas" = las que NO tienen cobrador, o sea las que cobra el admin en
  // persona; es el grupo que le importa a diario, así que va primero. En las de
  // los cobradores el admin también puede cobrar (tiene acceso total), pero son
  // supervisión, no su ruta del día.
  const misRutas = rutas?.filter((ruta) => ruta.cobradorId === null) ?? [];
  const rutasDeCobradores = rutas?.filter((ruta) => ruta.cobradorId !== null) ?? [];

  return (
    <>
      <AdminPageHeader
        title="Rutas"
        subtitle={
          summary
            ? `${summary.rutasTotal} ${summary.rutasTotal === 1 ? "ruta" : "rutas"} · ${summary.clientesEnRuta} clientes`
            : undefined
        }
        actions={
          // En móvil el alta vive en el FAB, para no apretar el header.
          <Button asChild className={cn("hidden lg:inline-flex", HEADER_ACTION_CLASS)}>
            <Link href="/admin/routes-collectors/new">
              <PlusIcon />
              Nueva ruta
            </Link>
          </Button>
        }
      />

      <div className="flex min-w-0 flex-col gap-6 p-4 sm:p-6">
        {/* Resumen compacto en móvil: tres MetricCard apiladas se comen la
            pantalla entera antes de llegar a la primera ruta. */}
        <MetricTileGroup columns={3} divided className="sm:hidden">
          <MetricTile
            label="Abiertas"
            value={summary?.rutasAbiertas ?? "—"}
            sub={summary ? `de ${summary.rutasTotal}` : undefined}
          />
          <MetricTile
            label="Cobrado hoy"
            value={summary ? formatCurrency(summary.cobradoHoy) : "—"}
          />
          <MetricTile label="Clientes" value={summary?.clientesEnRuta ?? "—"} />
        </MetricTileGroup>

        <div className="hidden gap-4 sm:grid sm:grid-cols-2 lg:grid-cols-3">
          <MetricCard
            tone="success"
            icon={<MapPinIcon />}
            label="Rutas abiertas"
            value={summary?.rutasAbiertas ?? "—"}
            sub={summary ? `de ${summary.rutasTotal}` : undefined}
          />
          <MetricCard
            tone="primary"
            icon={<BanknoteIcon />}
            label="Cobrado hoy"
            value={summary ? formatCurrency(summary.cobradoHoy) : "—"}
          />
          <MetricCard
            tone="primary"
            icon={<UserIcon />}
            label="Clientes en ruta"
            value={summary?.clientesEnRuta ?? "—"}
          />
        </div>

        <RutasGroup
          title="Mis rutas"
          hint="Sin cobrador asignado — las cobras tú"
          rutas={misRutas}
          isLoading={isLoading}
          emptyText="No tienes rutas propias. Una ruta sin cobrador asignado aparece acá."
          showCobrador={false}
        />

        <RutasGroup
          title="Rutas de cobradores"
          hint="Asignadas a un cobrador — puedes cobrar en ellas igual"
          rutas={rutasDeCobradores}
          isLoading={isLoading}
          emptyText="Ninguna ruta tiene cobrador asignado todavía."
        />
      </div>

      {/* FAB de alta en móvil, por encima de la bottom tab bar (h-16). */}
      <Button
        asChild
        size="lg"
        className="fixed right-4 z-30 rounded-full shadow-lg lg:hidden"
        style={{ bottom: "calc(5rem + env(safe-area-inset-bottom))" }}
      >
        <Link href="/admin/routes-collectors/new">
          <PlusIcon />
          Nueva ruta
        </Link>
      </Button>
    </>
  );
}

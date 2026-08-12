"use client";

import { useState } from "react";
import Link from "next/link";
import { DownloadIcon, SquareCheckBigIcon } from "lucide-react";
import { toast } from "sonner";
import type { DailyClosureListItem } from "@repo/types";

import { parseFechaInicio } from "@/entities/credit";
import { useRutas } from "@/features/routes-collectors/api/use-rutas";
import { ApiError } from "@/shared/api/client";
import { formatCurrency } from "@/shared/lib/format-currency";
import { formatDate } from "@/shared/lib/format-date";
import { cn } from "@/shared/lib/utils";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { MetricTile, MetricTileGroup } from "@/shared/ui/metric-tile";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { EmptyState } from "@/shared/ui/empty-state";
import { Skeleton } from "@/shared/ui/skeleton";
import { SkeletonList } from "@/shared/ui/skeletons";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/tooltip";
import { AdminPageHeader } from "@/widgets/admin-shell/AdminPageHeader";

import { useClosureDetail, useClosuresList, useDownloadClosurePdf } from "../api/use-closures";
import { closurePdfFilename } from "../lib/pdf-filename";

// `DailyClosure.date`/`DailyClosureListItem.date` viajan como "YYYY-MM-DD"
// (un día calendario, no un instante) — `new Date(string)` los lee como
// medianoche UTC y `formatDate` fija la zona a `America/Bogota` (UTC-5), así
// que un cierre del 20 se vería el 19. Mismo gotcha que `fechaInicio` de
// Crédito (ver CLAUDE.md); reusamos el mismo fix en vez de reinventarlo.
function fmtClosureDate(date: string): string {
  return formatDate(parseFechaInicio(date));
}

function downloadClosureError(error: unknown): string {
  return error instanceof ApiError ? error.message : "No se pudo descargar el PDF.";
}

function DownloadPdfButton({
  closure,
  className,
}: {
  closure: { id: string; rutaNombre: string; date: string };
  className?: string;
}) {
  const download = useDownloadClosurePdf();

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={cn("inline-flex", className)}>
          <Button
            variant="ghost"
            size="icon"
            loading={download.isPending}
            aria-label="Descargar PDF"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              download.mutate(
                { id: closure.id, filename: closurePdfFilename(closure.rutaNombre, closure.date) },
                { onError: (error) => toast.error(downloadClosureError(error)) },
              );
            }}
          >
            <DownloadIcon />
          </Button>
        </span>
      </TooltipTrigger>
      <TooltipContent>Descargar PDF</TooltipContent>
    </Tooltip>
  );
}

function ClosureRow({
  closure,
  selected,
  showRuta,
  onSelect,
}: {
  closure: DailyClosureListItem;
  selected: boolean;
  showRuta: boolean;
  onSelect: () => void;
}) {
  return (
    <div className="relative">
      <Link
        href={`/admin/closures/${closure.id}`}
        className="absolute inset-0 z-10 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none lg:hidden"
      >
        <span className="sr-only">Ver cierre de {closure.rutaNombre} del {fmtClosureDate(closure.date)}</span>
      </Link>

      <button
        type="button"
        onClick={onSelect}
        className={cn(
          "flex w-full items-center gap-3 border-l-2 px-4 py-3 text-left transition-colors sm:pr-14",
          selected
            ? "border-primary bg-primary/10 lg:border-primary"
            : "border-transparent hover:bg-muted",
          selected && "max-lg:border-transparent max-lg:bg-transparent",
        )}
      >
        <div className="flex min-w-0 flex-1 flex-col">
          {showRuta ? <span className="truncate text-sm font-medium">{closure.rutaNombre}</span> : null}
          <span className="truncate text-caption text-muted-foreground">
            {fmtClosureDate(closure.date)}
            {closure.closedByNombre ? ` · ${closure.closedByNombre}` : ""}
          </span>
        </div>
        <span className="shrink-0 text-sm font-semibold tabular-nums">
          {formatCurrency(closure.totalCollected)}
        </span>
        <Badge status={closure.status === "OPEN" ? "ruta-abierta" : "ruta-cerrada"}>
          {closure.status === "OPEN" ? "Abierta" : "Cerrada"}
        </Badge>
      </button>

      {/* Fuera del `<button>` de selección a propósito: un `<button>` no puede
          contener otro `<button>` (HTML inválido, error de hidratación en
          React). Se posiciona flotando sobre la fila en vez de en el flujo —
          mismo espíritu que el stretched link de arriba, con `z-20` para
          quedar por encima. `sm:pr-14` en el botón de selección le deja el
          espacio para no superponerse con el texto. */}
      <DownloadPdfButton
        closure={closure}
        className="absolute top-1/2 right-3 z-20 hidden -translate-y-1/2 sm:inline-flex"
      />
    </div>
  );
}

function ClosurePreviewPanel({ id }: { id: string }) {
  const { data: closure, isLoading } = useClosureDetail(id);
  const download = useDownloadClosurePdf();

  if (isLoading || !closure) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col">
          <span className="text-h3 font-semibold">{closure.rutaNombre}</span>
          <span className="text-body-sm text-muted-foreground">
            {fmtClosureDate(closure.date)}
            {closure.closedByNombre ? ` · ${closure.closedByNombre}` : ""}
          </span>
          <Badge status={closure.status === "OPEN" ? "ruta-abierta" : "ruta-cerrada"} className="mt-1.5">
            {closure.status === "OPEN" ? "Abierta" : "Cerrada"}
          </Badge>
        </div>
        <Button
          variant="secondary"
          loading={download.isPending}
          onClick={() =>
            download.mutate(
              { id: closure.id, filename: closurePdfFilename(closure.rutaNombre, closure.date) },
              { onError: (error) => toast.error(downloadClosureError(error)) },
            )
          }
        >
          <DownloadIcon />
          Descargar PDF
        </Button>
      </div>

      <MetricTileGroup columns={4} divided>
        <MetricTile value={formatCurrency(closure.totalCollected)} label="Total cobrado" />
        <MetricTile value={String(closure.newCredits)} label="Créditos nuevos" />
        <MetricTile value={String(closure.productsSold)} label="Productos vendidos" />
        <MetricTile value={String(closure.unpaidCount)} label="Sin pagar" tone="destructive" />
      </MetricTileGroup>

      <div className="flex flex-col gap-1">
        <p className="mb-1 text-caption text-muted-foreground uppercase">Clientes sin pagar hoy</p>
        {closure.unpaidClients.length === 0 ? (
          <p className="text-sm text-muted-foreground">Todos los clientes pagaron ese día.</p>
        ) : (
          closure.unpaidClients.map((cliente) => (
            <div
              key={cliente.clienteId}
              className="flex items-center justify-between border-b border-border/60 py-2 last:border-0"
            >
              <span className="text-sm text-muted-foreground">{cliente.nombre}</span>
              <span className="text-sm font-medium tabular-nums">{formatCurrency(cliente.saldoPendiente)}</span>
            </div>
          ))
        )}
      </div>

      <Button asChild className="mt-auto">
        <Link href={`/admin/closures/${closure.id}`}>Ver detalle completo</Link>
      </Button>
    </div>
  );
}

// DESIGN_SYSTEM.md §3.12 — Histórico de cierres (#12c). Mismo patrón
// maestro-detalle que `ClientsListScreen`: en escritorio (`lg+`) seleccionar
// una fila alimenta el panel de la derecha sin navegar; en móvil la fila
// navega directo al detalle completo (`/admin/closures/[id]`, #13c), donde
// vive el panel de la derecha no cabe.
export function ClosuresHistoryScreen() {
  const [routeId, setRouteId] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: rutas = [] } = useRutas();
  const { data: closures, isLoading } = useClosuresList({
    ...(routeId !== "all" ? { routeId } : {}),
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
  });

  const activeId = selectedId ?? closures?.[0]?.id ?? null;

  return (
    <>
      <AdminPageHeader
        title="Cierres diarios"
        subtitle={closures ? `${closures.length} ${closures.length === 1 ? "cierre" : "cierres"}` : undefined}
      />

      <div className="grid min-w-0 flex-1 grid-cols-1 gap-6 p-4 sm:p-6 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        {/* Maestro: filtros + lista */}
        <div className="flex min-w-0 flex-col gap-4">
          <Select value={routeId} onValueChange={setRouteId}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Todas las rutas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las rutas</SelectItem>
              {rutas.map((ruta) => (
                <SelectItem key={ruta.id} value={ruta.id}>
                  {ruta.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex items-end gap-3">
            <div className="flex flex-1 flex-col gap-1.5">
              <Label htmlFor="closures-from" className="text-caption text-muted-foreground">
                Desde
              </Label>
              <Input
                id="closures-from"
                type="date"
                value={from}
                max={to || undefined}
                onChange={(e) => setFrom(e.target.value)}
              />
            </div>
            <div className="flex flex-1 flex-col gap-1.5">
              <Label htmlFor="closures-to" className="text-caption text-muted-foreground">
                Hasta
              </Label>
              <Input
                id="closures-to"
                type="date"
                value={to}
                min={from || undefined}
                onChange={(e) => setTo(e.target.value)}
              />
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border border-border bg-card">
            {isLoading ? (
              <div className="flex flex-col gap-3 p-4">
                <SkeletonList rows={5} />
              </div>
            ) : closures && closures.length > 0 ? (
              <div className="flex flex-col divide-y divide-border">
                {closures.map((closure) => (
                  <ClosureRow
                    key={closure.id}
                    closure={closure}
                    showRuta={routeId === "all"}
                    selected={closure.id === activeId}
                    onSelect={() => setSelectedId(closure.id)}
                  />
                ))}
              </div>
            ) : (
              <EmptyState
                size="inline"
                icon={<SquareCheckBigIcon />}
                title="Ningún cierre con estos filtros"
                description="Probá ampliando el rango de fechas o eligiendo otra ruta."
                className="m-4 border-0 bg-transparent"
              />
            )}
          </div>
        </div>

        {/* Detalle: vista previa del cierre seleccionado. Solo en escritorio. */}
        <div className="hidden min-w-0 flex-col rounded-lg border border-border bg-card p-6 lg:flex">
          {activeId ? (
            <ClosurePreviewPanel id={activeId} />
          ) : (
            <p className="m-auto text-body-sm text-muted-foreground">
              Selecciona un cierre para ver su resumen.
            </p>
          )}
        </div>
      </div>
    </>
  );
}

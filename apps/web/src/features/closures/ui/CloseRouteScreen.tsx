"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { CheckCircle2Icon, CircleCheckIcon, DownloadIcon } from "lucide-react";
import { toast } from "sonner";
import type { DailyClosure } from "@repo/types";

import { ClientCard } from "@/entities/client";
import { buildWhatsAppUrl } from "@/entities/receipt";
import { ApiError } from "@/shared/api/client";
import { formatCurrency } from "@/shared/lib/format-currency";
import { formatDateShort } from "@/shared/lib/format-date";
import { Button } from "@/shared/ui/button";
import { EmptyState } from "@/shared/ui/empty-state";
import { MetricTile, MetricTileGroup } from "@/shared/ui/metric-tile";
import { Skeleton } from "@/shared/ui/skeleton";
import { WhatsAppIcon } from "@/shared/ui/icons/whatsapp-icon";
import { CollectorHero } from "@/widgets/collector-shell/CollectorHero";

import { useCloseRoute, useClosurePreview, useDownloadClosurePdf } from "../api/use-closures";
import { buildClosureShareText } from "../lib/build-share-text";
import { closurePdfFilename } from "../lib/pdf-filename";
import { ConfirmCloseDialog } from "./ConfirmCloseDialog";

// DESIGN_SYSTEM.md §4.6 — Cierre de ruta (#19c). Hero + tarjeta resumen
// superpuesta (mismo patrón que el detalle de ruta, #15c: `MetricTileGroup`
// con `overlap`) → clientes sin pagar (Client card compacta, sin porcentaje
// de avance: `ClosurePreview.unpaidClients` no lo trae, es un agregado del
// cierre, no del crédito) → botón destructive pegado al fondo → modal de
// confirmación. "Ruta ya cerrada hoy" bloquea el botón; justo después de
// cerrar (con el snapshot ya en mano) ofrece descargar el PDF y compartir un
// resumen por WhatsApp — un cierre reabierto en otra sesión (sin el
// snapshot a mano) solo muestra el estado, sin esas acciones: `ClosurePreview`
// no trae el `id` del cierre cuando ya estaba cerrado de antes.
export function CloseRouteScreen() {
  const params = useParams<{ id: string }>();
  const routeId = params.id;
  const { data: preview, isLoading, isError, refetch } = useClosurePreview(routeId);
  const closeRoute = useCloseRoute(routeId);
  const download = useDownloadClosurePdf();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [closedResult, setClosedResult] = useState<DailyClosure | null>(null);

  // Sin esto, un fetch que falla (red caída, API mal configurada) dejaba
  // `isLoading=false` y `preview=undefined` — la condición de abajo seguía
  // siendo verdadera para siempre y la pantalla quedaba en Skeleton sin
  // ningún indicio de error.
  if (isError) {
    return (
      <div className="flex flex-col pb-6">
        <CollectorHero title="Cierre de ruta" backHref={`/collector/routes/${routeId}`} />
        <div className="flex flex-col items-center gap-3 px-4 pt-6 text-center">
          <p className="text-sm font-medium">No pudimos cargar el cierre de esta ruta</p>
          <p className="text-caption text-muted-foreground">
            Revisá tu conexión e intentá de nuevo.
          </p>
          <Button variant="secondary" onClick={() => refetch()}>
            Reintentar
          </Button>
        </div>
      </div>
    );
  }

  if (isLoading || !preview) {
    return (
      <div className="flex flex-col pb-6">
        <CollectorHero title="Cierre de ruta" backHref={`/collector/routes/${routeId}`} />
        <div className="-mt-9 flex flex-col gap-3 px-4">
          <Skeleton className="h-19 w-full rounded-xl" />
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-19 w-full rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  const alreadyClosed = preview.alreadyClosed || closedResult !== null;
  const unpaidCount = preview.unpaidClients.length;

  const handleConfirm = async () => {
    try {
      const closure = await closeRoute.mutateAsync();
      setClosedResult(closure);
      setConfirmOpen(false);
      toast.success("Ruta cerrada. Los totales del día quedaron congelados.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo cerrar la ruta.");
    }
  };

  const handleDownloadPdf = () => {
    if (!closedResult) return;
    download.mutate(
      { id: closedResult.id, filename: closurePdfFilename(closedResult.rutaNombre, closedResult.date) },
      {
        onError: (error) =>
          toast.error(error instanceof ApiError ? error.message : "No se pudo descargar el PDF."),
      },
    );
  };

  return (
    <div className="flex flex-col pb-6">
      <CollectorHero
        title="Cierre de ruta"
        subtitle={`${preview.rutaNombre} · hoy, ${formatDateShort(new Date())}`}
        backHref={`/collector/routes/${routeId}`}
      />

      <div className="px-4">
        <MetricTileGroup columns={3} divided overlap>
          <MetricTile value={formatCurrency(preview.totalCollected)} label="Cobrado hoy" />
          <MetricTile value={String(preview.collectedCount)} label="Cobros" />
          <MetricTile value={String(unpaidCount)} label="Sin pagar" tone="destructive" />
        </MetricTileGroup>
      </div>

      <div className="flex flex-col gap-4 px-4 pt-4">
        {alreadyClosed ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-success/30 bg-success/5 p-8 text-center">
            <CheckCircle2Icon className="size-8 text-success-strong" aria-hidden />
            <p className="text-sm font-medium">Ruta ya cerrada hoy</p>
            <p className="text-caption text-muted-foreground">
              El cierre de hoy ya quedó registrado. Mañana esta pantalla vuelve a abrir el día.
            </p>

            {closedResult ? (
              <div className="mt-2 flex w-full flex-col gap-2">
                <Button variant="secondary" loading={download.isPending} onClick={handleDownloadPdf}>
                  <DownloadIcon />
                  Descargar PDF
                </Button>
                <Button variant="secondary" asChild>
                  <a
                    href={buildWhatsAppUrl({ text: buildClosureShareText(closedResult) })}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <WhatsAppIcon className="size-4" />
                    Compartir por WhatsApp
                  </a>
                </Button>
              </div>
            ) : null}
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-2">
              <h2 className="text-caption font-semibold tracking-wide text-muted-foreground uppercase">
                Clientes sin pagar
              </h2>
              {unpaidCount === 0 ? (
                <EmptyState
                  size="inline"
                  icon={<CircleCheckIcon />}
                  title="Todos los clientes de la ruta pagaron hoy"
                  description="Podés cerrar la ruta sin pendientes."
                />
              ) : (
                <div className="flex flex-col gap-3">
                  {preview.unpaidClients.map((cliente) => (
                    <ClientCard
                      key={cliente.clienteId}
                      cliente={{ nombre: cliente.nombre, ruta: { id: routeId, nombre: preview.rutaNombre } }}
                      amount={cliente.saldoPendiente}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Pegado al fondo del área scrolleable (por encima de la bottom
                tab bar, que vive fuera de `main` en `CollectorShell`): siempre
                alcanzable sin tener que llegar al final de la lista. */}
            <Button
              variant="destructive"
              size="lg"
              className="sticky bottom-4 mt-2 shadow-lg"
              onClick={() => setConfirmOpen(true)}
            >
              Cerrar ruta
            </Button>
          </>
        )}
      </div>

      <ConfirmCloseDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        totalCollected={preview.totalCollected}
        collectedCount={preview.collectedCount}
        unpaidCount={unpaidCount}
        loading={closeRoute.isPending}
        onConfirm={handleConfirm}
      />
    </div>
  );
}

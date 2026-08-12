"use client";

import { useState } from "react";
import { CircleCheckIcon, DownloadIcon } from "lucide-react";
import { toast } from "sonner";
import type { DailyClosure } from "@repo/types";

import { buildWhatsAppUrl } from "@/entities/receipt";
import { ApiError } from "@/shared/api/client";
import { formatCurrency } from "@/shared/lib/format-currency";
import { formatDateShort } from "@/shared/lib/format-date";
import { Button } from "@/shared/ui/button";
import { EmptyState } from "@/shared/ui/empty-state";
import { MetricTile, MetricTileGroup } from "@/shared/ui/metric-tile";
import { Skeleton } from "@/shared/ui/skeleton";
import { WhatsAppIcon } from "@/shared/ui/icons/whatsapp-icon";
import { AdminPageHeader } from "@/widgets/admin-shell/AdminPageHeader";

import { useCloseRoute, useClosurePreview, useDownloadClosurePdf } from "../api/use-closures";
import { buildClosureShareText } from "../lib/build-share-text";
import { closurePdfFilename } from "../lib/pdf-filename";
import { ConfirmCloseDialog } from "./ConfirmCloseDialog";
import { UnpaidClientsList } from "./UnpaidClientsList";

// Espejo de `CloseRouteScreen` (#19c, Cobrador) en la superficie del Admin —
// mismos hooks (`useClosurePreview`/`useCloseRoute`/`useDownloadClosurePdf`,
// genéricos, sin acoplamiento a una superficie) y misma lógica de estado
// (preview → confirmar → snapshot recién cerrado con PDF/WhatsApp), pero con
// `AdminPageHeader` en vez de `CollectorHero` y la lista rica de clientes sin
// pagar (`UnpaidClientsList`, con llamar/recordar) que ya usa `ClosureDetailScreen`
// en vez del `ClientCard` simple del Cobrador — el Admin también puede cerrar
// "Mis rutas" (las que cobra en persona, ver `RouteDetailScreen` de
// `features/cobros`) o cualquier ruta de cobradores de su tenant.
export function AdminCloseRouteScreen({ rutaId }: { rutaId: string }) {
  const { data: preview, isLoading, isError, refetch } = useClosurePreview(rutaId);
  const closeRoute = useCloseRoute(rutaId);
  const download = useDownloadClosurePdf();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [closedResult, setClosedResult] = useState<DailyClosure | null>(null);

  const backHref = `/admin/routes-collectors/${rutaId}`;

  // Sin esto, un fetch que falla (red caída, API mal configurada) dejaba
  // `isLoading=false` y `preview=undefined` — la condición de abajo seguía
  // siendo verdadera para siempre y la pantalla quedaba en Skeleton sin
  // ningún indicio de error. Mismo fix que `CloseRouteScreen`.
  if (isError) {
    return (
      <>
        <AdminPageHeader backHref={backHref} eyebrow="Rutas" title="Cerrar ruta" />
        <div className="flex flex-col items-center gap-3 p-4 pt-8 text-center sm:p-6">
          <p className="text-sm font-medium">No pudimos cargar el cierre de esta ruta</p>
          <p className="text-caption text-muted-foreground">
            Revisá tu conexión e intentá de nuevo.
          </p>
          <Button variant="secondary" onClick={() => refetch()}>
            Reintentar
          </Button>
        </div>
      </>
    );
  }

  if (isLoading || !preview) {
    return (
      <>
        <AdminPageHeader backHref={backHref} eyebrow="Rutas" title="Cerrar ruta" />
        <div className="flex flex-col gap-4 p-4 sm:p-6">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </>
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
    <>
      <AdminPageHeader
        backHref={backHref}
        eyebrow="Rutas"
        title={`Cerrar ${preview.rutaNombre}`}
        subtitle={`Hoy, ${formatDateShort(new Date())}`}
      />

      <div className="flex min-w-0 flex-col gap-6 p-4 sm:p-6">
        <MetricTileGroup columns={3} divided>
          <MetricTile value={formatCurrency(preview.totalCollected)} label="Cobrado hoy" />
          <MetricTile value={String(preview.collectedCount)} label="Cobros" />
          <MetricTile value={String(unpaidCount)} label="Sin pagar" tone="destructive" />
        </MetricTileGroup>

        {alreadyClosed ? (
          <div className="flex flex-col items-center gap-3 rounded-lg border border-success/30 bg-success/5 p-8 text-center">
            <CircleCheckIcon className="size-8 text-success-strong" aria-hidden />
            <p className="text-sm font-medium">Ruta ya cerrada hoy</p>
            <p className="text-caption text-muted-foreground">
              El cierre de hoy ya quedó registrado. Mañana esta pantalla vuelve a abrir el día.
            </p>

            {closedResult ? (
              <div className="mt-2 flex w-full flex-col gap-2 sm:max-w-sm">
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
            <div className="flex min-w-0 flex-col gap-3">
              <h2 className="text-body-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Clientes sin pagar ({unpaidCount})
              </h2>
              {unpaidCount === 0 ? (
                <EmptyState
                  size="inline"
                  icon={<CircleCheckIcon />}
                  title="Todos los clientes de la ruta pagaron hoy"
                  description="Podés cerrar la ruta sin pendientes."
                />
              ) : (
                <UnpaidClientsList clients={preview.unpaidClients} />
              )}
            </div>

            <Button
              variant="destructive"
              size="lg"
              className="sm:max-w-xs"
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
    </>
  );
}

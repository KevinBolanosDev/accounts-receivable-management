"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { CheckCircle2Icon } from "lucide-react";
import { toast } from "sonner";

import { ClientCard } from "@/entities/client";
import { formatCurrency } from "@/shared/lib/format-currency";
import { formatDateShort } from "@/shared/lib/format-date";
import { Button } from "@/shared/ui/button";
import { MetricTile, MetricTileGroup } from "@/shared/ui/metric-tile";
import { Skeleton } from "@/shared/ui/skeleton";
import { CollectorHero } from "@/widgets/collector-shell/CollectorHero";

import { useCloseRoute, useClosurePreview } from "../api/use-closures";
import { ConfirmCloseDialog } from "./ConfirmCloseDialog";

// DESIGN_SYSTEM.md §4.6 — Cierre de ruta (#19c). Hero + tarjeta resumen
// superpuesta (mismo patrón que el detalle de ruta, #15c: `MetricTileGroup`
// con `overlap`) → clientes sin pagar (Client card compacta, sin porcentaje
// de avance: `ClosurePreview.unpaidClients` no lo trae, es un agregado del
// cierre, no del crédito) → botón destructive pegado al fondo → modal de
// confirmación. "Ruta ya cerrada hoy" bloquea el botón (idempotencia visible
// desde el front, la real la garantiza el backend en 5.7). El PDF/compartir
// por WhatsApp llegan con el cableado (5.10) — acá el mock solo confirma el
// cierre.
export function CloseRouteScreen() {
  const params = useParams<{ id: string }>();
  const routeId = params.id;
  const { data: preview, isLoading } = useClosurePreview(routeId);
  const closeRoute = useCloseRoute(routeId);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [justClosed, setJustClosed] = useState(false);

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

  const alreadyClosed = preview.alreadyClosed || justClosed;
  const unpaidCount = preview.unpaidClients.length;

  const handleConfirm = async () => {
    try {
      await closeRoute.mutateAsync();
      setJustClosed(true);
      setConfirmOpen(false);
      toast.success("Ruta cerrada. Los totales del día quedaron congelados.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo cerrar la ruta.");
    }
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
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-card p-8 text-center">
            <CheckCircle2Icon className="size-8 text-success" aria-hidden />
            <p className="text-sm font-medium">Ruta ya cerrada hoy</p>
            <p className="text-caption text-muted-foreground">
              El cierre de hoy ya quedó registrado. Mañana esta pantalla vuelve a abrir el día.
            </p>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-2">
              <h2 className="text-caption font-semibold tracking-wide text-muted-foreground uppercase">
                Clientes sin pagar
              </h2>
              {unpaidCount === 0 ? (
                <p className="rounded-lg border border-dashed border-border bg-card p-4 text-center text-caption text-muted-foreground">
                  Todos los clientes de la ruta pagaron hoy.
                </p>
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

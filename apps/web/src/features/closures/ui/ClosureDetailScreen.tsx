"use client";

import { DownloadIcon } from "lucide-react";
import { toast } from "sonner";

import { parseFechaInicio } from "@/entities/credit";
import { ApiError } from "@/shared/api/client";
import { getInitials } from "@/shared/lib/initials";
import { formatCurrency } from "@/shared/lib/format-currency";
import { formatDate } from "@/shared/lib/format-date";
import { Badge } from "@/shared/ui/badge";
import { Skeleton } from "@/shared/ui/skeleton";
import { AdminPageHeader } from "@/widgets/admin-shell/AdminPageHeader";
import { PageActions } from "@/widgets/admin-shell/PageActions";

import { useClosureDetail, useDownloadClosurePdf } from "../api/use-closures";
import { closurePdfFilename } from "../lib/pdf-filename";
import { PaidClientsList } from "./PaidClientsList";
import { UnpaidClientsList } from "./UnpaidClientsList";

// Ver el comentario del mismo helper en `ClosuresHistoryScreen.tsx`: `date`
// viaja como "YYYY-MM-DD" y necesita anclarse a mediodía UTC antes de
// formatear en `America/Bogota`, si no se ve un día atrás.
function fmtClosureDate(date: string): string {
  return formatDate(parseFechaInicio(date));
}

// DESIGN_SYSTEM.md §3.13 — Detalle del cierre (#13c). Snapshot congelado: lee
// `DailyClosure` tal como se persistió, nunca recalcula. Dos columnas desde
// `lg` (resumen + clientes sin pagar); apiladas en móvil, con la tabla de
// clientes reemplazada por tarjetas (mismo patrón mobile-first que
// `RoutesListScreen`).
export function ClosureDetailScreen({ id }: { id: string }) {
  const { data: closure, isLoading, isError } = useClosureDetail(id);
  const download = useDownloadClosurePdf();

  if (isLoading) {
    return (
      <>
        <AdminPageHeader backHref="/admin/closures" eyebrow="Cierres" title="Detalle del cierre" />
        <div className="flex flex-col gap-4 p-4 sm:p-6">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </>
    );
  }

  if (isError || !closure) {
    return (
      <>
        <AdminPageHeader backHref="/admin/closures" eyebrow="Cierres" title="Detalle del cierre" />
        <div className="p-4 sm:p-6">
          <p className="rounded-lg border border-dashed border-border bg-card p-8 text-center text-body-sm text-muted-foreground">
            Este cierre no existe o no tienes acceso a él.
          </p>
        </div>
      </>
    );
  }

  return (
    <>
      <AdminPageHeader
        backHref="/admin/closures"
        eyebrow={`Cierres / ${fmtClosureDate(closure.date)}`}
        title={closure.rutaNombre}
        actions={
          <PageActions
            actions={[
              {
                id: "pdf",
                label: download.isPending ? "Descargando…" : "Descargar PDF",
                icon: <DownloadIcon />,
                disabled: download.isPending,
                onSelect: () =>
                  download.mutate(
                    { id: closure.id, filename: closurePdfFilename(closure.rutaNombre, closure.date) },
                    {
                      onError: (error) =>
                        toast.error(
                          error instanceof ApiError ? error.message : "No se pudo descargar el PDF.",
                        ),
                    },
                  ),
              },
            ]}
          />
        }
      />

      <div className="grid min-w-0 flex-1 grid-cols-1 gap-6 p-4 sm:p-6 lg:grid-cols-[360px_minmax(0,1fr)]">
        {/* Resumen del cierre */}
        <div className="flex min-w-0 flex-col gap-5 rounded-lg border border-border bg-card p-6">
          <div className="flex items-center gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-semibold">
              {closure.closedByNombre ? getInitials(closure.closedByNombre) : "—"}
            </span>
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-sm font-semibold">
                {closure.closedByNombre ?? "Cierre automático"}
              </span>
              <span className="truncate text-caption text-muted-foreground">{closure.rutaNombre}</span>
            </div>
          </div>

          <dl className="flex flex-col gap-3 text-sm">
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">Fecha</dt>
              <dd className="font-medium">{fmtClosureDate(closure.date)}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">Estado</dt>
              <dd>
                <Badge status={closure.status === "OPEN" ? "ruta-abierta" : "ruta-cerrada"}>
                  {closure.status === "OPEN" ? "Abierta" : "Cerrada"}
                </Badge>
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">Total cobrado</dt>
              <dd className="font-semibold tabular-nums">{formatCurrency(closure.totalCollected)}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">Créditos nuevos</dt>
              <dd className="font-medium tabular-nums">{closure.newCredits}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">Productos vendidos</dt>
              <dd className="font-medium tabular-nums">{closure.productsSold}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">Clientes sin pagar</dt>
              <dd className="font-medium tabular-nums text-destructive">{closure.unpaidCount}</dd>
            </div>
          </dl>
        </div>

        <div className="flex min-w-0 flex-col gap-6">
          {/* Clientes que pagaron: del snapshot congelado, nunca recalculado.
              `paidClients === null` = cierre de antes de que este campo
              existiera (no se recalcula), distinto de "nadie pagó" (array
              vacío). */}
          <div className="flex min-w-0 flex-col gap-3 rounded-lg border border-border bg-card p-6">
            <h2 className="text-caption font-semibold tracking-wide text-muted-foreground uppercase">
              Clientes que pagaron{closure.paidClients ? ` (${closure.paidClients.length})` : ""}
            </h2>

            {closure.paidClients === null ? (
              <p className="rounded-lg border border-dashed border-border bg-background p-8 text-center text-body-sm text-muted-foreground">
                No disponible para cierres anteriores a esta función.
              </p>
            ) : closure.paidClients.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border bg-background p-8 text-center text-body-sm text-muted-foreground">
                Nadie pagó este día.
              </p>
            ) : (
              <PaidClientsList payments={closure.paidClients} />
            )}
          </div>

          {/* Clientes sin pagar: del snapshot congelado, nunca recalculado. */}
          <div className="flex min-w-0 flex-col gap-3 rounded-lg border border-border bg-card p-6">
            <h2 className="text-caption font-semibold tracking-wide text-muted-foreground uppercase">
              Clientes sin pagar ({closure.unpaidCount})
            </h2>

            {closure.unpaidClients.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border bg-background p-8 text-center text-body-sm text-muted-foreground">
                Todos los clientes pagaron ese día.
              </p>
            ) : (
              <UnpaidClientsList clients={closure.unpaidClients} />
            )}
          </div>
        </div>
      </div>
    </>
  );
}

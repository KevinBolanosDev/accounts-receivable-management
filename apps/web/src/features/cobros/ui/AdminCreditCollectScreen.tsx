"use client";

import { useMemo } from "react";
import { CheckIcon } from "lucide-react";
import type { PaymentHistoryItem } from "@repo/types";

import { CUOTA_LABEL } from "@/entities/credit";
import {
  PaymentHistory,
  cobroDeHoy,
  esCuotaAnulada,
  esCuotaSinPagar,
  pagosDeCredito,
} from "@/entities/payment";
import { ReceiptActions, useReceiptActions } from "@/entities/receipt";
import { useSessionStore } from "@/entities/session";
import { useCliente } from "@/features/clients/api/use-clientes";
import { formatCurrency } from "@/shared/lib/format-currency";
import { formatDate } from "@/shared/lib/format-date";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { ErrorState, NotFoundState } from "@/shared/ui/error-state";
import { MetricTile, MetricTileGroup } from "@/shared/ui/metric-tile";
import { Skeleton } from "@/shared/ui/skeleton";
import { AdminPageHeader } from "@/widgets/admin-shell/AdminPageHeader";

import { AnularPagoButton } from "./AnularPagoButton";
import { RegistrarCobroSheet } from "./RegistrarCobroSheet";

// Detalle de UN crédito con cobro, para el Admin
// (`/admin/routes-collectors/[id]/clients/[clienteId]/credits/[creditoId]`).
//
// Es el final del flujo de cobro del Admin y espeja a
// `CollectorCreditDetailScreen`: mismos componentes de `entities/payment` y
// `entities/receipt`, mismo `scope: "staff"` del recibo. Las diferencias son la
// superficie (header del Admin en vez del hero del Cobrador), el bloque de
// cuotas pendientes/mora — que el admin necesita para decidir, no solo para
// cobrar — y que el recibo se abre en `/admin/receipts/[pagoId]`.
//
// Reusa la MISMA query cacheada que la pantalla anterior (`["clientes", id]`),
// así que entrar acá es instantáneo y no dispara otra petición.

interface AdminCreditCollectScreenProps {
  rutaId: string;
  clienteId: string;
  creditoId: string;
}

interface PendientesResumen {
  /** Cuotas ya vencidas y sin pagar (incluye la que vence hoy). */
  pendientes: number;
  /** De esas, cuántas ya están en mora (7+ días de atraso). */
  enMora: number;
  /** Días de atraso de la cuota impaga más antigua. */
  peorAtraso: number;
  /** Fecha de vencimiento de la próxima cuota sin pagar. */
  proximoVencimiento: string | null;
}

function resumirPendientes(pagos: PaymentHistoryItem[]): PendientesResumen {
  const sinPagar = pagos.filter((pago) => esCuotaSinPagar(pago.estado));
  return {
    pendientes: sinPagar.length,
    enMora: sinPagar.filter((pago) => pago.estado === "DEFAULTED").length,
    peorAtraso: sinPagar.reduce((max, pago) => Math.max(max, pago.diasAtraso), 0),
    // El historial viene ordenado con la cuota más alta primero, así que la
    // impaga más antigua es la última de la lista.
    proximoVencimiento: sinPagar.at(-1)?.fechaVencimiento ?? null,
  };
}

export function AdminCreditCollectScreen({
  rutaId,
  clienteId,
  creditoId,
}: AdminCreditCollectScreenProps) {
  const { data: cliente, isLoading, isError, refetch } = useCliente(clienteId);
  const token = useSessionStore((state) => state.token);
  const recibos = useReceiptActions({ scope: "staff", token });

  const credito = useMemo(
    () =>
      cliente
        ? [...cliente.creditosActivos, ...cliente.creditosHistorial].find((c) => c.id === creditoId)
        : undefined,
    [cliente, creditoId],
  );

  const pagos = useMemo(
    () => pagosDeCredito(cliente?.historialPagos, creditoId),
    [cliente?.historialPagos, creditoId],
  );

  const cobradoHoy = useMemo(() => cobroDeHoy(pagos), [pagos]);
  const pendientes = useMemo(() => resumirPendientes(pagos), [pagos]);

  const volverAlCliente = `/admin/routes-collectors/${rutaId}/clients/${clienteId}`;

  if (isLoading) {
    return (
      <>
        <AdminPageHeader backHref={volverAlCliente} eyebrow="Rutas" title="Crédito" />
        <div className="flex flex-col gap-3 p-4 sm:p-6">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </>
    );
  }

  if (isError || !cliente || !credito) {
    return (
      <>
        <AdminPageHeader backHref={volverAlCliente} eyebrow="Rutas" title="Crédito" />
        <div className="flex flex-col items-center p-4 sm:p-6">
          {isError ? (
            <ErrorState
              title="No se pudo cargar el crédito"
              onRetry={() => void refetch()}
              className="w-full max-w-md"
            />
          ) : (
            <NotFoundState
              entity={cliente ? "este crédito" : "este cliente"}
              description={
                cliente
                  ? `${cliente.nombre} no tiene un crédito con ese identificador.`
                  : "Puede que se haya eliminado o que ya no pertenezca a tu cartera."
              }
              backHref={volverAlCliente}
              backLabel="Volver a los créditos"
              className="w-full max-w-md"
            />
          )}
        </div>
      </>
    );
  }

  const activo = credito.estado === "ACTIVO" || credito.estado === "MORA";

  return (
    <>
      <AdminPageHeader
        backHref={volverAlCliente}
        eyebrow={`Rutas / ${cliente.ruta?.nombre ?? "Sin ruta"} / ${cliente.nombre}`}
        title={credito.producto}
        subtitle={`${credito.codigo} · ${credito.cuotasTotal} ${credito.cuotasTotal === 1 ? "cuota" : "cuotas"} · ${CUOTA_LABEL[credito.frecuencia].toLowerCase()} de ${formatCurrency(credito.cuotaDiaria)}`}
      />

      <div className="flex min-w-0 flex-col gap-6 p-4 sm:p-6">
        <MetricTileGroup columns={4} divided>
          <MetricTile label="Saldo pendiente" value={formatCurrency(credito.saldoPendiente)} />
          <MetricTile label="Pagado" value={formatCurrency(credito.totalPagado)} tone="success" />
          <MetricTile label="Cuotas" value={`${credito.cuotasPagadas}/${credito.cuotasTotal}`} />
          {/* Lo que el admin no tenía en ninguna pantalla: cuánto se debe HOY,
              y si eso ya escaló a mora. Sale del historial que arma el backend
              (`buildPaymentHistory`), no de una cuenta paralela acá. */}
          <MetricTile
            label="Cuotas vencidas"
            value={String(pendientes.pendientes)}
            sub={
              pendientes.enMora > 0
                ? `${pendientes.enMora} en mora · ${pendientes.peorAtraso} días`
                : pendientes.proximoVencimiento
                  ? `vence ${formatDate(pendientes.proximoVencimiento)}`
                  : "al día"
            }
            tone={pendientes.enMora > 0 ? "destructive" : undefined}
          />
        </MetricTileGroup>

        {activo ? (
          <div className="flex flex-col gap-2 sm:max-w-sm">
            {cobradoHoy ? (
              <div className="flex items-center gap-2 rounded-lg bg-success/10 px-3 py-2 text-body-sm text-success-strong">
                <CheckIcon className="size-4 shrink-0" />
                <span>
                  Cobrado hoy: {formatCurrency(cobradoHoy.total)} en {cobradoHoy.pagos}{" "}
                  {cobradoHoy.pagos === 1 ? "abono" : "abonos"}
                </span>
              </div>
            ) : null}
            <RegistrarCobroSheet
              creditos={[credito]}
              clienteNombre={cliente.nombre}
              creditoPreseleccionado={credito}
              receiptBasePath="/admin/receipts"
            >
              {/* Sigue disponible después de cobrar: el cliente puede abonar de
                  nuevo el mismo día o cancelar el crédito completo. */}
              <Button
                size="lg"
                variant={cobradoHoy ? "secondary" : "primary"}
                className={cn(
                  "w-full",
                  !cobradoHoy &&
                    "bg-linear-to-r from-primary to-accent text-primary-foreground hover:opacity-95",
                )}
              >
                {cobradoHoy ? "Registrar otro abono" : "Registrar cobro"}
              </Button>
            </RegistrarCobroSheet>
          </div>
        ) : null}

        <div className="flex min-w-0 flex-col gap-3">
          <h2 className="text-body-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Historial de cuotas
          </h2>
          <PaymentHistory
            pagos={pagos}
            cuotasTotal={credito.cuotasTotal}
            producto={credito.producto}
            emptyText="Este crédito todavía no tiene pagos registrados."
            renderActions={(pago) =>
              esCuotaSinPagar(pago.estado) ? null : (
                <div className="flex items-center gap-1">
                  <ReceiptActions
                    actions={["download", "share"]}
                    onDownload={() => void recibos.download(pago.id, pago.reciboCodigo ?? undefined)}
                    pending={recibos.pendingPagoId === pago.id ? recibos.pendingKind : null}
                    // Al teléfono del cliente: es a quien va dirigido el recibo.
                    phone={cliente.telefono}
                    share={{ clienteNombre: cliente.nombre, publicUrl: pago.reciboPublicUrl }}
                    // Adjunta el PDF por la hoja nativa del teléfono; si el
                    // navegador no soporta compartir archivos, `ReceiptActions`
                    // cae solo al enlace `wa.me`.
                    onShare={(text) =>
                      recibos.share(pago.id, { text, codigo: pago.reciboCodigo ?? undefined })
                    }
                  />
                  {/* Un pago ya anulado no se puede anular otra vez. */}
                  {esCuotaAnulada(pago.estado) ? null : <AnularPagoButton pago={pago} />}
                </div>
              )
            }
          />
        </div>
      </div>
    </>
  );
}

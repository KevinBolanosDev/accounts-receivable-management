"use client";

import { useMemo } from "react";
import { CheckIcon } from "lucide-react";

import {
  PaymentHistory,
  cobroDeHoy,
  esCuotaSinPagar,
  pagosDeCredito,
} from "@/entities/payment";
import { ReceiptActions, useReceiptActions } from "@/entities/receipt";
import { useSessionStore } from "@/entities/session";
import { useCliente } from "@/features/clients/api/use-clientes";
import { formatCurrency } from "@/shared/lib/format-currency";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { MetricTile, MetricTileGroup } from "@/shared/ui/metric-tile";
import { Skeleton } from "@/shared/ui/skeleton";
import { CollectorHero } from "@/widgets/collector-shell/CollectorHero";

import { RegistrarCobroSheet } from "./RegistrarCobroSheet";

// Detalle de UN crédito para el Cobrador: info del crédito + el historial de
// SUS cuotas, con recibo descargable y compartible por WhatsApp.
//
// Espeja 1:1 a `ClientCreditDetailScreen` del Portal — mismos componentes de
// `entities/payment` y `entities/receipt`; lo único distinto es el `scope` del
// recibo ("staff" vs "client") y que acá se puede registrar un cobro.
//
// Reusa la MISMA query cacheada que la pantalla anterior (`["clientes", id]`),
// así que entrar al detalle es instantáneo y no dispara otra petición.
interface CollectorCreditDetailScreenProps {
  clienteId: string;
  creditoId: string;
}

export function CollectorCreditDetailScreen({
  clienteId,
  creditoId,
}: CollectorCreditDetailScreenProps) {
  const { data: cliente, isLoading } = useCliente(clienteId);
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

  const volverAlCliente = `/collector/routes/payments/${clienteId}?tab=historial`;

  if (isLoading || !cliente) {
    return (
      <div className="flex flex-col pb-6">
        <CollectorHero title="Crédito" backHref={volverAlCliente} />
        <div className="relative z-10 -mt-9 flex flex-col gap-3 px-4">
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (!credito) {
    return (
      <div className="flex flex-col pb-6">
        <CollectorHero title="Crédito" backHref={volverAlCliente} />
        <div className="px-4 pt-6">
          <div className="rounded-xl border border-dashed border-border bg-card p-6 text-center">
            <p className="text-body-sm text-muted-foreground">
              No encontramos este crédito entre los de {cliente.nombre}.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const activo = credito.estado === "ACTIVO" || credito.estado === "MORA";

  return (
    <div className="flex flex-col gap-4 pb-6">
      <CollectorHero
        title={credito.producto}
        subtitle={`${credito.codigo} · ${cliente.nombre}`}
        backHref={volverAlCliente}
      />

      <div className="px-4">
        <MetricTileGroup columns={3} divided overlap>
          <MetricTile label="Saldo pendiente" value={formatCurrency(credito.saldoPendiente)} />
          <MetricTile
            label="Pagado"
            value={formatCurrency(credito.totalPagado)}
            tone="success"
          />
          <MetricTile label="Cuotas" value={`${credito.cuotasPagadas}/${credito.cuotasTotal}`} />
        </MetricTileGroup>
      </div>

      {activo ? (
        <div className="flex flex-col gap-2 px-4">
          {cobradoHoy ? (
            <div className="flex items-center gap-2 rounded-lg bg-success/10 px-3 py-2 text-body-sm text-success">
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

      <div className="flex flex-col gap-3 px-4">
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
              <ReceiptActions
                actions={["download", "share"]}
                onDownload={() => void recibos.download(pago.id, pago.reciboCodigo ?? undefined)}
                pending={recibos.pendingPagoId === pago.id ? recibos.pendingKind : null}
                // Se comparte al teléfono del cliente: es a quien va dirigido
                // el recibo, y evita que el cobrador tenga que buscarlo.
                phone={cliente.telefono}
                share={{
                  clienteNombre: cliente.nombre,
                  producto: credito.producto,
                  numeroCuota: pago.numeroCuota,
                  cuotasTotal: credito.cuotasTotal,
                  monto: pago.monto,
                  fecha: pago.fecha,
                  reciboCodigo: pago.reciboCodigo,
                  publicUrl: pago.reciboPublicUrl,
                }}
              />
            )
          }
        />
      </div>
    </div>
  );
}

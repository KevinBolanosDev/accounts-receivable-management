"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";

import { useClientSessionStore } from "@/entities/session";
import { PaymentHistory, esCuotaSinPagar } from "@/entities/payment";
import { ReceiptActions, useReceiptActions } from "@/entities/receipt";
import { formatCurrency } from "@/shared/lib/format-currency";
import { formatDateShort } from "@/shared/lib/format-date";
import { Card, CardContent } from "@/shared/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { MetricTile, MetricTileGroup } from "@/shared/ui/metric-tile";
import { ProgressRing } from "@/shared/ui/progress-ring";
import { Skeleton } from "@/shared/ui/skeleton";

import { useMyCreditDetail } from "../api/use-client-portal";

// DESIGN_SYSTEM.md §5.2 — `#21c`, detalle de UN crédito (la lista vive aparte
// en `ClientCreditsListScreen`, ver decisión #12 de la Fase 4).
//
// El historial y las acciones de recibo salen de `entities/payment` y
// `entities/receipt`: el detalle de crédito del Cobrador usa exactamente los
// mismos componentes, solo cambia el `scope` y qué acciones se pintan.
export function ClientCreditDetailScreen({ creditoId }: { creditoId: string }) {
  const { data: credito, isLoading } = useMyCreditDetail(creditoId);
  const token = useClientSessionStore((state) => state.token);
  const [reciboHtml, setReciboHtml] = useState<string | null>(null);

  const recibos = useReceiptActions({
    scope: "client",
    token,
    onHtml: (html) => setReciboHtml(html),
  });

  if (isLoading || !credito) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-6 px-6 py-8">
        <Skeleton className="h-64 w-full" />
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-6 px-6 py-8">
      <header className="space-y-1">
        <Link
          href="/client/credit"
          className="inline-flex items-center gap-1 text-caption text-muted-foreground hover:text-foreground"
        >
          <ArrowLeftIcon className="size-3.5" />
          Mis créditos
        </Link>
        <p className="text-caption uppercase tracking-wider text-muted-foreground">
          {credito.cliente.nombre} · {credito.producto}
        </p>
        <h1 className="text-h1">{credito.codigo}</h1>
      </header>

      <Card>
        <CardContent className="flex flex-col items-center gap-4 p-6 sm:flex-row sm:items-stretch sm:justify-around">
          <ProgressRing size="hero" value={Math.round(credito.porcentajePagado)} showLabel />
          <div className="flex flex-col justify-center gap-2 text-center sm:text-left">
            <div>
              <p className="text-caption uppercase tracking-wider text-muted-foreground">
                Saldo pendiente
              </p>
              <p className="text-display tabular-nums">{formatCurrency(credito.saldoPendiente)}</p>
            </div>
            {credito.proximaFechaCuota ? (
              <div>
                <p className="text-caption uppercase tracking-wider text-muted-foreground">
                  Próxima cuota
                </p>
                <p className="text-h3 font-semibold tabular-nums">
                  {formatDateShort(credito.proximaFechaCuota)} ·{" "}
                  {formatCurrency(credito.cuotaDiaria)}
                </p>
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <MetricTileGroup columns={3} divided>
        <MetricTile
          label="Cuotas"
          value={`${credito.cuotasPagadas}/${credito.cuotasTotal}`}
        />
        <MetricTile label="Pagado" value={formatCurrency(credito.totalPagado)} />
        <MetricTile label="Total con interés" value={formatCurrency(credito.montoTotal)} />
      </MetricTileGroup>

      <div className="flex flex-col gap-3">
        <h2 className="text-h3 font-semibold">Historial de pagos</h2>
        <PaymentHistory
          pagos={credito.pagos}
          cuotasTotal={credito.cuotasTotal}
          producto={credito.producto}
          emptyText="Sin pagos registrados todavía."
          renderActions={(pago) =>
            esCuotaSinPagar(pago.estado) ? null : (
              <ReceiptActions
                actions={["view", "download", "share"]}
                onView={() => void recibos.view(pago.id)}
                onDownload={() => void recibos.download(pago.id, pago.reciboCodigo ?? undefined)}
                pending={recibos.pendingPagoId === pago.id ? recibos.pendingKind : null}
                share={{
                  clienteNombre: credito.cliente.nombre,
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

      <Dialog open={!!reciboHtml} onOpenChange={(open) => !open && setReciboHtml(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Recibo de pago</DialogTitle>
          </DialogHeader>
          {reciboHtml ? (
            <iframe title="Recibo" srcDoc={reciboHtml} className="h-[70vh] w-full border-0" />
          ) : null}
        </DialogContent>
      </Dialog>
    </main>
  );
}

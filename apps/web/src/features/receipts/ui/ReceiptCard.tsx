"use client";

import type { Receipt } from "@repo/types";

import { ReceiptActions } from "@/entities/receipt";
import { Card, CardContent, CardFooter, CardHeader } from "@/shared/ui/card";
import { formatCurrency } from "@/shared/lib/format-currency";
import { formatDateTime } from "@/shared/lib/format-date";

interface ReceiptCardProps {
  receipt: Receipt;
  /**
   * Enlace público firmado del recibo (`/r/:token`) — el que se comparte por
   * WhatsApp. Antes esto era `appUrl` y se compartía `/client/login`: el
   * destinatario tenía que tener acceso al portal y buscar el recibo a mano.
   */
  publicUrl?: string | null;
  /** Teléfono destino del WhatsApp. */
  phone?: string | null;
  /** Código del recibo, ya conocido (cuando viene de CobroResponse). */
  reciboCodigo?: string;
  /** Si true, oculta los botones (variante embebida en historial). */
  compact?: boolean;
}

// Recibo visual (pantalla #18c). Versión UI del HTML server-rendered que
// sirve el back en 4.8 — se usa cuando tenemos el shape `Receipt`. Cuando
// abrimos el recibo al cobrar (4.9), el back ya sirve el HTML completo y se
// monta directo en un iframe.
export function ReceiptCard({
  receipt,
  publicUrl,
  phone,
  reciboCodigo,
  compact = false,
}: ReceiptCardProps) {
  const codigo = reciboCodigo ?? receipt.codigo;

  return (
    <Card className="mx-auto w-full max-w-md print:shadow-none print:border-0">
      <CardHeader className="text-center">
        <p className="text-caption uppercase text-muted-foreground tracking-wider">
          Recibo de pago
        </p>
        <p className="text-h3 font-semibold tabular-nums">{codigo}</p>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="rounded-lg bg-muted/40 p-4 text-center">
          <p className="text-caption uppercase text-muted-foreground tracking-wider">
            Monto pagado
          </p>
          <p className="mt-1 text-display tabular-nums">
            {formatCurrency(receipt.monto)}
          </p>
        </div>

        <dl className="grid grid-cols-2 gap-3 text-body-sm">
          <div>
            <dt className="text-caption uppercase text-muted-foreground">Cliente</dt>
            <dd className="font-medium">{receipt.credito.clienteNombre}</dd>
          </div>
          <div>
            <dt className="text-caption uppercase text-muted-foreground">Producto</dt>
            <dd className="font-medium">{receipt.credito.productoNombre}</dd>
          </div>
          <div>
            <dt className="text-caption uppercase text-muted-foreground">Crédito</dt>
            <dd className="font-medium tabular-nums">{receipt.credito.codigo}</dd>
          </div>
          <div>
            <dt className="text-caption uppercase text-muted-foreground">Fecha</dt>
            {/* Con hora: dos cobros del mismo cliente el mismo día generan
                recibos que de otro modo se verían idénticos. */}
            <dd className="font-medium tabular-nums">{formatDateTime(receipt.fecha)}</dd>
          </div>
          <div className="col-span-2 rounded-md border border-border p-3">
            <dt className="text-caption uppercase text-muted-foreground">
              Saldo restante
            </dt>
            <dd className="mt-0.5 text-h3 font-semibold tabular-nums">
              {formatCurrency(receipt.saldoRestante)}
            </dd>
          </div>
        </dl>
      </CardContent>

      {!compact && (
        <CardFooter className="print:hidden">
          <ReceiptActions
            variant="labeled"
            actions={["download", "share"]}
            // La tarjeta YA está en pantalla, así que imprimir la página actual
            // alcanza (el `print:hidden`/`print:shadow-none` la dejan limpia).
            // No hace falta bajar el HTML del recibo como en las filas del
            // historial.
            onDownload={() => window.print()}
            phone={phone}
            share={{
              clienteNombre: receipt.credito.clienteNombre,
              producto: receipt.credito.productoNombre,
              monto: receipt.monto,
              fecha: receipt.fecha,
              reciboCodigo: codigo,
              publicUrl,
            }}
            className="w-full justify-center gap-3"
          />
        </CardFooter>
      )}
    </Card>
  );
}
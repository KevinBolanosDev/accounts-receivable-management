import type { Receipt } from "@repo/types";

import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/shared/ui/card";
import { formatCurrency } from "@/shared/lib/format-currency";

interface ReceiptCardProps {
  receipt: Receipt;
  /** URL pública del front (NEXT_PUBLIC_APP_URL) — usada por "Compartir por WhatsApp". */
  appUrl: string;
  /** Código del recibo, ya conocido (cuando viene de CobroResponse). */
  reciboCodigo?: string;
  /** Si true, oculta los botones (variante embebida en historial). */
  compact?: boolean;
}

// Recibo visual (pantalla #18c). Versión UI del HTML server-rendered que
// sirve el back en 4.8 — se usa cuando tenemos el shape `Receipt` (ej. en el
// historial del portal del cliente). Cuando abrimos el recibo al cobrar
// (4.9), el back ya sirve el HTML completo y se monta directo en un iframe.
export function ReceiptCard({ receipt, appUrl, reciboCodigo, compact = false }: ReceiptCardProps) {
  const codigo = reciboCodigo ?? receipt.codigo;

  // wa.me prellenado — no requiere API de WhatsApp Business, abre el cliente
  // del usuario con el mensaje listo. El enlace apunta al portal del cliente
  // con su sesión (ya autenticado por credenciales).
  const shareUrl = `${appUrl}/client/login`;
  const shareText = `Hola ${receipt.credito.clienteNombre}, te compartimos tu recibo de pago.`;
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`;

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
            <dd className="font-medium tabular-nums">
              {new Date(receipt.fecha).toLocaleDateString("es-CO")}
            </dd>
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
        <CardFooter className="flex flex-col gap-2 print:hidden">
          <Button asChild className="w-full">
            <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
              Compartir por WhatsApp
            </a>
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="w-full"
            onClick={() => window.print()}
          >
            Descargar / Imprimir
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}
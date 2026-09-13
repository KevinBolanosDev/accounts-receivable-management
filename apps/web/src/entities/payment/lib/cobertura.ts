import type { PaymentHistoryItem } from "@repo/types";

import { formatCurrency } from "@/shared/lib/format-currency";

// Etiquetas cortas para anotar un pago que no fue un simple "1 pago = 1 cuota
// exacta" (espejo, más resumido, de `describeCobertura` en `receipt-pdf.ts`,
// back). Devuelve una lista (0, 1 o 2 etiquetas) en vez de una sola frase
// larga: cada una se pinta como un chip corto (`whitespace-nowrap`) que nunca
// necesita truncarse ni partirse a la mitad — una frase única y larga es la
// que se recortaba en mobile y desbordaba la columna "Monto" en escritorio.
//
// `cuotasCubiertas`/`saldoAFavor`/`porcentajeProximaCuota` vienen calculados
// del backend (`buildPaymentHistory`, dinero acumulado ÷ valor de cuota, no
// por orden de pago) — acá solo se arma el texto.
//
// `cuotasTotal` (opcional, el mismo prop que ya reciben `PaymentRow`/
// `PaymentHistoryTable`) solo se usa para topar el número de la "próxima
// cuota" en el caso de abajo — nunca cambia si se muestra o no un chip.
export function coberturaLabels(pago: PaymentHistoryItem, cuotasTotal?: number): string[] {
  const labels: string[] = [];
  if (pago.cuotasCubiertas > 1) {
    labels.push(`Cubrió ${pago.cuotasCubiertas} cuotas`);
  }
  if (pago.saldoAFavor > 0) {
    const porcentaje = Math.round(pago.porcentajeProximaCuota);
    const monto = formatCurrency(pago.saldoAFavor);
    // Si este MISMO pago ya completó una cuota (`cuotasCubiertas >= 1`), el
    // saldo que sobra ya no es hacia la cuota del encabezado — esa quedó
    // completa — sino hacia la SIGUIENTE. Sin decir cuál, un pago que solo
    // aporta a la cuota 5 y otro que la completa y arranca la 6 se ven
    // idénticos ("A favor: $85.000 (68%)" en los dos), como si la cuota
    // estuviera duplicada. Es justo el caso que reportó un usuario real.
    if (pago.cuotasCubiertas >= 1) {
      const proxima = cuotasTotal
        ? Math.min(cuotasTotal, pago.cuotasCubiertasAcumuladas + 1)
        : pago.cuotasCubiertasAcumuladas + 1;
      labels.push(`A favor: ${monto} (cuota ${proxima}, ${porcentaje}%)`);
    } else {
      labels.push(`A favor: ${monto} (${porcentaje}%)`);
    }
  }
  return labels;
}

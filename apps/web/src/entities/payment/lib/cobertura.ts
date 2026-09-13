import type { PaymentHistoryItem } from "@repo/types";

import { formatCurrency } from "@/shared/lib/format-currency";

// Frase corta para anotar un pago que no fue un simple "1 pago = 1 cuota
// exacta" (espejo de `describeCobertura` en `receipt-pdf.ts`, back). `null` =
// pago normal, no se muestra nada extra.
//
// `cuotasCubiertas`/`saldoAFavor`/`porcentajeProximaCuota` vienen calculados
// del backend (`buildPaymentHistory`, dinero acumulado ÷ valor de cuota, no
// por orden de pago) — acá solo se arma el texto.
export function describeCobertura(pago: PaymentHistoryItem): string | null {
  const partes: string[] = [];
  if (pago.cuotasCubiertas > 1) {
    partes.push(`Cubrió ${pago.cuotasCubiertas} cuotas de una vez`);
  }
  if (pago.saldoAFavor > 0) {
    partes.push(
      `Saldo a favor: ${formatCurrency(pago.saldoAFavor)} (${pago.porcentajeProximaCuota.toFixed(1)}% de la próxima cuota)`,
    );
  }
  return partes.length > 0 ? partes.join(" · ") : null;
}

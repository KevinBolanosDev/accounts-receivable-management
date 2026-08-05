import type { PaymentHistoryItem } from "@repo/types";

import { isToday } from "@/shared/lib/format-date";
import { esCuotaAnulada, esCuotaSinPagar } from "./cuota-estado";

// Helpers puros sobre el historial de pagos.
//
// Reemplazan el `useMemo` de ~30 líneas que `ClientPaymentsScreen` usaba para
// re-derivar a mano el número de cuota y una referencia sintética. Ese cálculo
// ahora llega correcto del backend (`buildPaymentHistory`, con unit tests), así
// que acá solo queda agrupar y resumir.

/**
 * Solo los pagos REALES y VIGENTES: descarta las filas sintéticas de cuota
 * sin pagar Y los pagos anulados. Sin lo segundo, "Anular pago" devolvía el
 * saldo al crédito pero el banner "Cobrado hoy" (que resume ESTA lista) seguía
 * contando la plata que ya se había devuelto — como si nunca se hubiera anulado.
 */
export function soloPagosReales(pagos: PaymentHistoryItem[]): PaymentHistoryItem[] {
  return pagos.filter((pago) => !esCuotaSinPagar(pago.estado) && !esCuotaAnulada(pago.estado));
}

export function pagosDeCredito(
  pagos: PaymentHistoryItem[] | undefined,
  creditoId: string,
): PaymentHistoryItem[] {
  return (pagos ?? []).filter((pago) => pago.creditoId === creditoId);
}

export function agruparPagosPorCredito(
  pagos: PaymentHistoryItem[] | undefined,
): Map<string, PaymentHistoryItem[]> {
  const grupos = new Map<string, PaymentHistoryItem[]>();
  for (const pago of pagos ?? []) {
    const actual = grupos.get(pago.creditoId);
    if (actual) actual.push(pago);
    else grupos.set(pago.creditoId, [pago]);
  }
  return grupos;
}

export interface ResumenHistorial {
  /** Cuántos pagos reales (sin contar cuotas no pagadas). */
  pagos: number;
  totalPagado: number;
  /** ISO del pago real más reciente, o `null` si no hay ninguno. */
  ultimoPago: string | null;
}

export function resumenHistorial(pagos: PaymentHistoryItem[]): ResumenHistorial {
  const reales = soloPagosReales(pagos);
  let ultimoPago: string | null = null;
  let totalPagado = 0;

  for (const pago of reales) {
    totalPagado += pago.monto;
    if (!ultimoPago || pago.fecha > ultimoPago) ultimoPago = pago.fecha;
  }

  return { pagos: reales.length, totalPagado: Number(totalPagado.toFixed(2)), ultimoPago };
}

/** Más reciente primero. El backend ya ordena por cuota; esto es para mezclas. */
export function ordenarPorFechaDesc(pagos: PaymentHistoryItem[]): PaymentHistoryItem[] {
  return [...pagos].sort((a, b) => b.fecha.localeCompare(a.fecha));
}

export interface CobroDeHoy {
  /** Cuántos abonos se registraron hoy en este crédito. */
  pagos: number;
  /** Suma de esos abonos. */
  total: number;
}

/**
 * Lo cobrado HOY en un crédito. Se usa para marcar la tarjeta como "Cobrado
 * hoy" sin esconder el botón de registrar: el cobrador puede volver a abonar
 * el mismo día (un segundo pago, o la cancelación total del crédito).
 */
export function cobroDeHoy(pagos: PaymentHistoryItem[]): CobroDeHoy | null {
  const deHoy = soloPagosReales(pagos).filter((pago) => isToday(pago.fechaPago));
  if (deHoy.length === 0) return null;
  return {
    pagos: deHoy.length,
    total: Number(deHoy.reduce((sum, pago) => sum + pago.monto, 0).toFixed(2)),
  };
}

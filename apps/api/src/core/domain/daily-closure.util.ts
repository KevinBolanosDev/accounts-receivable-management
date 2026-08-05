import type { EstadoCredito } from "@repo/types";

import { CLOSURE_TIMEZONE } from "../reports/closure-policy";
import { dayRange, localDateKey, utcDateKey } from "./day-boundary.util";
import {
  buildPaymentHistory,
  type PaymentScheduleCredito,
  type PaymentScheduleRow,
} from "./payment-schedule.util";

// Fase 5 — cálculo del cierre diario (totales + MORA), cero I/O: el service
// (`daily-closures`, 5.7) carga las filas de Prisma y las pasa PLANAS acá; el
// preview y el cierre reutilizan el mismo cálculo, así que "lo que se ve
// antes de cerrar" y "lo que se congela al cerrar" nunca pueden divergir.

export interface ClosureCreditRow extends PaymentScheduleCredito {
  clienteId: string;
  clienteNombre: string;
  clienteTelefono: string | null;
  estado: EstadoCredito;
  montoTotal: number;
  saldoPendiente: number;
  // TODOS los pagos vigentes del crédito (no solo los de hoy), ordenados
  // ascendente por `fecha` — `buildPaymentHistory` numera las cuotas por
  // orden cronológico completo; pasarle solo los pagos de hoy correría la
  // numeración y podría marcar como "vencida" una cuota que en realidad ya
  // se pagó ayer.
  pagos: PaymentScheduleRow[];
}

export interface ClosureUnpaidClient {
  clienteId: string;
  nombre: string;
  saldoPendiente: number;
  telefono: string | null;
}

export interface ClosureSummary {
  totalCollected: number;
  collectedCount: number;
  newCredits: number;
  newCreditsAmount: number;
  productsSold: number;
  unpaidClients: ClosureUnpaidClient[];
  /** Ids de créditos que pasan a MORA al cerrar (ver el comentario más abajo). */
  creditosEnMora: string[];
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function computeClosureSummary(input: {
  creditos: ClosureCreditRow[];
  date: Date;
}): ClosureSummary {
  const { creditos, date } = input;
  const { start, end } = dayRange(date, CLOSURE_TIMEZONE);
  const enElDia = (fecha: Date) => fecha >= start && fecha < end;

  let totalCollected = 0;
  let collectedCount = 0;
  let newCredits = 0;
  let newCreditsAmount = 0;
  const creditosEnMora: string[] = [];

  // Un cliente puede tener más de un crédito activo en la ruta: el saldo sin
  // pagar se acumula por cliente, y "sin pagar hoy" es que NINGUNO de sus
  // créditos activos haya recibido un pago en el rango del día.
  const porCliente = new Map<
    string,
    { nombre: string; telefono: string | null; saldoPendiente: number; pagoHoy: boolean }
  >();

  for (const credito of creditos) {
    // Totales del día: pagos vigentes (no anulados) dentro del rango, sin
    // importar en qué estado haya quedado el crédito después (un pago que
    // hoy saldó el crédito sigue siendo plata cobrada hoy).
    let pagoHoyEnEsteCredito = false;
    for (const pago of credito.pagos) {
      if (pago.anulado) continue;
      if (!enElDia(pago.fecha)) continue;
      totalCollected += pago.monto;
      collectedCount += 1;
      pagoHoyEnEsteCredito = true;
    }

    // Créditos nuevos: otorgados (fechaInicio) dentro del rango del día. Es
    // `fechaInicio`, no `createdAt` — el "día" de un crédito es el día de
    // desembolso que eligió el admin, no el timestamp técnico de la fila.
    if (enElDia(credito.fechaInicio)) {
      newCredits += 1;
      newCreditsAmount = round2(newCreditsAmount + credito.montoTotal);
    }

    if (credito.estado !== "ACTIVO") continue;

    // MORA: se materializa cuando el historial reporta al menos una cuota
    // DEFAULTED — el mismo umbral (`DIAS_PARA_MORA`, 7 días) que ya usa
    // `payment-schedule.util` para pintar "Mora" en el front, y el mismo
    // nombre en español ("Mora") que `EstadoCredito.MORA`. La spec de esta
    // fase habla de una fila "MISSED"; ese estado único se dividió en
    // PENDING/OVERDUE/DEFAULTED antes de Fase 5 (ver el comentario de
    // `cuotaEstadoSchema` en `@repo/types`) y DEFAULTED es su heredero
    // directo — OVERDUE ("Vencida", <7 días) todavía no es mora.
    const historial = buildPaymentHistory(credito, credito.pagos, date);
    if (historial.some((cuota) => cuota.estado === "DEFAULTED")) {
      creditosEnMora.push(credito.id);
    }

    const acumulado = porCliente.get(credito.clienteId) ?? {
      nombre: credito.clienteNombre,
      telefono: credito.clienteTelefono,
      saldoPendiente: 0,
      pagoHoy: false,
    };
    acumulado.saldoPendiente = round2(acumulado.saldoPendiente + credito.saldoPendiente);
    acumulado.pagoHoy = acumulado.pagoHoy || pagoHoyEnEsteCredito;
    porCliente.set(credito.clienteId, acumulado);
  }

  const unpaidClients: ClosureUnpaidClient[] = Array.from(porCliente.entries())
    .filter(([, info]) => !info.pagoHoy)
    .map(([clienteId, info]) => ({
      clienteId,
      nombre: info.nombre,
      saldoPendiente: info.saldoPendiente,
      telefono: info.telefono,
    }));

  return {
    totalCollected: round2(totalCollected),
    collectedCount,
    newCredits,
    newCreditsAmount,
    // 1 `Credito` = 1 `Producto` (FK simple, sin bundles) → coincide siempre
    // con `newCredits`. Se deja como cuenta aparte porque el contrato
    // (`@repo/types`) la expone como campo propio, no derivado en el front.
    productsSold: newCredits,
    unpaidClients,
    creditosEnMora,
  };
}

/**
 * ¿La ruta ya tiene un cierre para el día local de `date`? `closures[].date`
 * son valores `@db.Date` de Postgres (o `startOfLocalDay(...)` antes de
 * persistir): días calendario puros, sin zona horaria — se comparan por
 * `utcDateKey` (lectura directa en UTC), nunca reconvertidos por `tz`. El
 * lado que SÍ necesita `tz` es `date` (un instante real, típicamente "ahora").
 */
export function isRouteClosedOn(
  closures: { date: Date }[],
  date: Date,
  tz: string = CLOSURE_TIMEZONE,
): boolean {
  const objetivo = localDateKey(date, tz);
  return closures.some((c) => utcDateKey(c.date) === objetivo);
}

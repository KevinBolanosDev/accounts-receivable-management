import {
  DIAS_PARA_MORA,
  type CuotaEstado,
  type EstadoCredito,
  type PaymentHistoryItem,
} from "@repo/types";

import { buildReciboCodigo } from "./receipt-code.util";

// Fase 4 — cálculo de puntualidad de cuota para el Portal Cliente (#21c) y de
// la próxima fecha esperada para "Mis créditos". Compartido entre
// `client-portal` (único consumidor hoy) — vive en `core/domain` porque es
// lógica pura (cero I/O) candidata a ser reusada por `creditos`/`cobros` si
// alguna vez necesitan el mismo cálculo, sin crear un import feature→feature.
//
// Asume 1 cuota por día calendario desde `fechaInicio`, sin días de descanso
// (consistente con el negocio "cobro diario"). Si el negocio permite saltarse
// fines de semana/feriados, esto sobreestima `MISSED` — riesgo documentado en
// specs/FASE_4_SUBFASES.md.

const DIA_MS = 24 * 60 * 60 * 1000;

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DIA_MS);
}

// Diferencia en días de CALENDARIO (no de 24h exactas) entre dos fechas,
// normalizando a medianoche UTC — evita que la hora del día distorsione el
// resultado (p.ej. un crédito creado a las 23:50 y un pago a las 00:10 del
// día siguiente son días de calendario distintos, aunque falten 20 minutos).
function diffInCalendarDays(a: Date, b: Date): number {
  const utcA = Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), a.getUTCDate());
  const utcB = Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate());
  return Math.floor((utcA - utcB) / DIA_MS);
}

export interface PaymentScheduleCredito {
  id: string;
  fechaInicio: Date;
  dias: number;
}

export interface PaymentScheduleRow {
  id: string;
  creditoId: string;
  monto: number;
  fecha: Date;
  cobradorId: string;
  cobradorNombre: string | null;
  reciboUrl: string | null;
}

// Construye el historial enriquecido de un crédito: cada pago real recibe un
// `numeroCuota` (orden cronológico, 1er pago = cuota 1 — ver decisión #13) y
// un `estado` (`ON_TIME` si su día de calendario es igual o anterior al
// esperado, `LATE` si es posterior). Los días ya transcurridos sin pago
// correspondiente se agregan como filas sintéticas `MISSED` (no persisten en
// `Pago`, `monto: 0`, `reciboCodigo: null`).
export function buildPaymentHistory(
  credito: PaymentScheduleCredito,
  pagosOrdenados: PaymentScheduleRow[], // ordenados por `fecha` ascendente
  today: Date,
  // Enlace público firmado del recibo (`/r/:token`), el que se comparte por
  // WhatsApp. Entra como FUNCIÓN y no como service inyectado para que este
  // módulo siga siendo lógica pura sin I/O ni dependencias de Nest — el
  // caller (que sí tiene `ReceiptTokenService`) decide cómo construirla.
  buildPublicUrl?: (pagoId: string) => string,
): PaymentHistoryItem[] {
  const historial: PaymentHistoryItem[] = pagosOrdenados.map((pago, index) => {
    const numeroCuota = index + 1;
    const fechaEsperada = addDays(credito.fechaInicio, numeroCuota - 1);
    const diasAtraso = Math.max(0, diffInCalendarDays(pago.fecha, fechaEsperada));
    const estado: CuotaEstado = diasAtraso === 0 ? "ON_TIME" : "LATE";
    return {
      id: pago.id,
      creditoId: pago.creditoId,
      monto: pago.monto,
      // `fecha` se mantiene por compatibilidad con `pagoSchema`; la UI usa
      // `fechaVencimiento`/`fechaPago`, que son explícitas.
      fecha: pago.fecha.toISOString(),
      cobradorId: pago.cobradorId,
      cobradorNombre: pago.cobradorNombre,
      reciboUrl: pago.reciboUrl,
      numeroCuota,
      estado,
      fechaVencimiento: fechaEsperada.toISOString(),
      fechaPago: pago.fecha.toISOString(),
      diasAtraso,
      reciboCodigo: buildReciboCodigo(pago.id),
      reciboPublicUrl: buildPublicUrl?.(pago.id) ?? null,
    };
  });

  const diasTranscurridos = Math.min(
    diffInCalendarDays(today, credito.fechaInicio) + 1,
    credito.dias,
  );
  const cuotasFaltantes = Math.max(0, diasTranscurridos - pagosOrdenados.length);
  for (let i = 0; i < cuotasFaltantes; i++) {
    const numeroCuota = pagosOrdenados.length + i + 1;
    const fechaEsperada = addDays(credito.fechaInicio, numeroCuota - 1);
    // Días de calendario desde que venció. 0 = vence hoy, todavía se puede
    // cobrar; por eso no se marca como vencida hasta que pasa al día siguiente.
    const diasAtraso = Math.max(0, diffInCalendarDays(today, fechaEsperada));
    const estado: CuotaEstado =
      diasAtraso === 0 ? "PENDING" : diasAtraso >= DIAS_PARA_MORA ? "DEFAULTED" : "OVERDUE";

    historial.push({
      id: `unpaid-${credito.id}-${numeroCuota}`,
      creditoId: credito.id,
      monto: 0,
      fecha: fechaEsperada.toISOString(),
      cobradorId: "",
      cobradorNombre: null,
      reciboUrl: null,
      numeroCuota,
      estado,
      fechaVencimiento: fechaEsperada.toISOString(),
      // Sin pagar: no hay fecha de pago. Es justamente lo que distingue esta
      // fila de una pagada, y lo que la columna "Fecha pagado" deja ver.
      fechaPago: null,
      diasAtraso,
      // Fila sintética: no hay `Pago`, luego no hay recibo que mostrar ni
      // enlace que compartir.
      reciboCodigo: null,
      reciboPublicUrl: null,
    });
  }

  // Más reciente (o más próxima a vencer) primero.
  return historial.sort((a, b) => b.numeroCuota - a.numeroCuota);
}

export interface ProximaCuotaCredito {
  fechaInicio: Date;
  dias: number;
  cuotasPagadas: number;
  estado: EstadoCredito;
}

// Fecha esperada de la próxima cuota, para la lista "Mis créditos". `null` si
// el crédito ya está saldado/anulado o si ya se pagaron todas las cuotas.
export function computeProximaFechaCuota(credito: ProximaCuotaCredito): string | null {
  if (credito.estado === "PAGADO" || credito.estado === "ANULADO") return null;
  if (credito.cuotasPagadas >= credito.dias) return null;
  return addDays(credito.fechaInicio, credito.cuotasPagadas).toISOString();
}

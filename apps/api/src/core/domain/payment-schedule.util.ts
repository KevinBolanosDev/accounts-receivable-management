import {
  DIAS_PARA_MORA,
  type CuotaEstado,
  type EstadoCredito,
  type FrecuenciaPago,
  type PaymentHistoryItem,
} from "@repo/types";

import { buildReciboCodigo } from "./receipt-code.util";

// Fase 4 — cálculo de puntualidad de cuota para el Portal Cliente (#21c) y de
// la próxima fecha esperada para "Mis créditos". Compartido entre
// `client-portal` (único consumidor hoy) — vive en `core/domain` porque es
// lógica pura (cero I/O) candidata a ser reusada por `creditos`/`cobros` si
// alguna vez necesitan el mismo cálculo, sin crear un import feature→feature.
//
// Asume una cuota por PERÍODO (`frecuencia`) contada DESDE `fechaInicio` (el
// día del desembolso no se cobra: la primera cuota vence un período después),
// sin días de descanso ni saltos por feriados. Con `DIARIO` eso es una cuota
// por día calendario a partir del día siguiente, que es el comportamiento del
// negocio "cobro diario". Si el negocio permite saltarse fines de
// semana/feriados, esto sobreestima el atraso — riesgo documentado en
// specs/FASE_4_SUBFASES.md.
//
// El umbral de mora (`DIAS_PARA_MORA`) es el MISMO para las tres frecuencias:
// 7 días de atraso. En semanal eso ya es una cuota entera perdida, y en mensual
// una semana de atraso también es señal clara.

const DIA_MS = 24 * 60 * 60 * 1000;

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DIA_MS);
}

// Mismo día del mes, N meses después, preservando la hora del día (igual que
// `addDays`). Si el día no existe en el mes destino (31 de enero → febrero) cae
// al ÚLTIMO día de ese mes: es lo que espera quien paga "el 31 de cada mes", y
// evita el desborde de `setUTCMonth`, que convertiría el 31 de febrero en el 3
// de marzo. Todo en UTC, igual que `diffInCalendarDays`.
function addMonths(date: Date, months: number): Date {
  const dia = date.getUTCDate();
  const target = new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth() + months,
      1,
      date.getUTCHours(),
      date.getUTCMinutes(),
      date.getUTCSeconds(),
      date.getUTCMilliseconds(),
    ),
  );
  // Día 0 del mes siguiente = último día del mes destino.
  const ultimoDiaDelMes = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  target.setUTCDate(Math.min(dia, ultimoDiaDelMes));
  return target;
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

/**
 * Fecha en la que vence la cuota `numeroCuota` (1-indexada): **la cuota 1 vence
 * un período DESPUÉS de `fechaInicio`**, y de ahí en adelante se avanza un
 * período por cuota. En diario eso es el día siguiente al desembolso; en
 * semanal, 7 días después; en mensual, el mismo día del mes siguiente.
 *
 * El día del desembolso no se cobra: es la regla del negocio. Antes la cuota 1
 * vencía el MISMO `fechaInicio`, así que un crédito nacía con una cuota
 * pendiente el mismo día de otorgarlo.
 *
 * Es la ÚNICA función que sabe cuánto dura un período y dónde arranca el
 * cronograma. Todo lo demás en este módulo (historial, cuotas vencidas, próxima
 * cuota) se apoya en ella, así que un cambio de calendario (feriados, fines de
 * semana) se hace acá y aplica a todo el cronograma.
 */
export function fechaVencimientoCuota(
  fechaInicio: Date,
  numeroCuota: number,
  frecuencia: FrecuenciaPago,
): Date {
  const periodos = numeroCuota;
  switch (frecuencia) {
    case "MENSUAL":
      return addMonths(fechaInicio, periodos);
    case "SEMANAL":
      return addDays(fechaInicio, periodos * 7);
    case "DIARIO":
    default:
      return addDays(fechaInicio, periodos);
  }
}

/**
 * Interpreta la `fechaInicio` que llega en el body del crédito.
 *
 * Un `<input type="date">` manda `"2026-07-29"`, y `new Date("2026-07-29")` es
 * medianoche **UTC**. Como toda la UI formatea en `America/Bogota` (UTC-5), esa
 * medianoche se renderiza como el 28 de julio: el crédito quedaba mostrando un
 * día menos del que el usuario eligió, y con él todo su cronograma.
 *
 * Se ancla al **mediodía UTC** del día elegido: cae en el mismo día de
 * calendario en cualquier zona entre UTC-11 y UTC+11, así que ya no depende de
 * dónde esté el navegador ni el servidor. El resto del módulo compara días de
 * calendario en UTC, así que la hora del día no afecta ningún cálculo.
 *
 * Un timestamp completo (ISO con hora) se respeta tal cual: solo se normaliza
 * la forma `YYYY-MM-DD`.
 */
export function parseFechaInicio(fechaInicio: string): Date {
  const soloFecha = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fechaInicio);
  if (!soloFecha) return new Date(fechaInicio);
  const [, anio, mes, dia] = soloFecha;
  return new Date(Date.UTC(Number(anio), Number(mes) - 1, Number(dia), 12));
}

export interface PaymentScheduleCredito {
  id: string;
  fechaInicio: Date;
  /** Número de cuotas del plan (antes `dias`, cuando todo el cobro era diario). */
  cuotas: number;
  frecuencia: FrecuenciaPago;
}

/**
 * Cuántas cuotas YA vencieron a la fecha `today` (contando la que vence hoy),
 * con tope en el total del plan.
 *
 * Se itera en vez de dividir porque en `MENSUAL` los períodos no tienen la
 * misma cantidad de días: no hay una división que dé el resultado correcto para
 * los tres casos. `cuotas` es un número pequeño (decenas), así que el costo es
 * irrelevante frente a tener una sola definición de "cuándo vence una cuota".
 */
export function cuotasVencidasAlDia(credito: PaymentScheduleCredito, today: Date): number {
  let vencidas = 0;
  for (let numeroCuota = 1; numeroCuota <= credito.cuotas; numeroCuota++) {
    const vencimiento = fechaVencimientoCuota(credito.fechaInicio, numeroCuota, credito.frecuencia);
    if (diffInCalendarDays(today, vencimiento) < 0) break;
    vencidas++;
  }
  return vencidas;
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
// esperado, `LATE` si es posterior). Los períodos ya vencidos sin pago
// correspondiente se agregan como filas sintéticas sin pagar (no persisten en
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
    const fechaEsperada = fechaVencimientoCuota(
      credito.fechaInicio,
      numeroCuota,
      credito.frecuencia,
    );
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

  const cuotasVencidas = cuotasVencidasAlDia(credito, today);
  const cuotasFaltantes = Math.max(0, cuotasVencidas - pagosOrdenados.length);
  for (let i = 0; i < cuotasFaltantes; i++) {
    const numeroCuota = pagosOrdenados.length + i + 1;
    const fechaEsperada = fechaVencimientoCuota(
      credito.fechaInicio,
      numeroCuota,
      credito.frecuencia,
    );
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
  cuotas: number;
  frecuencia: FrecuenciaPago;
  cuotasPagadas: number;
  estado: EstadoCredito;
}

// Fecha esperada de la próxima cuota, para la lista "Mis créditos". `null` si
// el crédito ya está saldado/anulado o si ya se pagaron todas las cuotas.
export function computeProximaFechaCuota(credito: ProximaCuotaCredito): string | null {
  if (credito.estado === "PAGADO" || credito.estado === "ANULADO") return null;
  if (credito.cuotasPagadas >= credito.cuotas) return null;
  return fechaVencimientoCuota(
    credito.fechaInicio,
    credito.cuotasPagadas + 1,
    credito.frecuencia,
  ).toISOString();
}

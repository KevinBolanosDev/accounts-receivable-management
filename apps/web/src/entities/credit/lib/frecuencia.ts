import { frecuenciaPagoSchema, type FrecuenciaPago } from "@repo/types";

// Vocabulario de UI de la frecuencia de pago (diaria/semanal/mensual) y la
// aritmética de vencimientos que la acompaña.
//
// Existe porque `cuotaDiaria` es un nombre histórico del contrato: hoy es la
// cuota del período que fije `frecuencia`, así que ninguna pantalla puede
// escribir "diaria" fijo. Todo lo que titula, sufija o proyecta una cuota pasa
// por acá; si mañana se agrega QUINCENAL, este archivo es el único que cambia
// del lado del front.

export const FRECUENCIA_LABEL: Record<FrecuenciaPago, string> = {
  DIARIO: "Diaria",
  SEMANAL: "Semanal",
  MENSUAL: "Mensual",
};

/** Título de la cifra de la cuota ("Cuota semanal"). */
export const CUOTA_LABEL: Record<FrecuenciaPago, string> = {
  DIARIO: "Cuota diaria",
  SEMANAL: "Cuota semanal",
  MENSUAL: "Cuota mensual",
};

/** Sufijo de la cifra en una línea compacta ("$300.000/semana"). */
export const CUOTA_SUFIJO: Record<FrecuenciaPago, string> = {
  DIARIO: "/día",
  SEMANAL: "/semana",
  MENSUAL: "/mes",
};

/** Plural para la vista previa del alta ("4 cuotas semanales de $300.000"). */
export const CUOTAS_PLURAL: Record<FrecuenciaPago, string> = {
  DIARIO: "cuotas diarias",
  SEMANAL: "cuotas semanales",
  MENSUAL: "cuotas mensuales",
};

/** Nombre del período, para hablar de una cuota suelta ("cada semana"). */
export const PERIODO_LABEL: Record<FrecuenciaPago, string> = {
  DIARIO: "día",
  SEMANAL: "semana",
  MENSUAL: "mes",
};

// Orden de los `<SelectItem>` del formulario. Se deriva del enum del contrato
// para que no se desincronicen: agregar una frecuencia en `@repo/types` la hace
// aparecer acá (y falla el typecheck de los Record de arriba hasta traducirla).
export const FRECUENCIA_OPTIONS: { value: FrecuenciaPago; label: string }[] =
  frecuenciaPagoSchema.options.map((value) => ({ value, label: FRECUENCIA_LABEL[value] }));

const DIA_MS = 24 * 60 * 60 * 1000;

/**
 * Interpreta una fecha de inicio que puede venir como `"2026-07-29"` (lo que
 * manda un `<input type="date">`) o como ISO completo (lo que devuelve la API).
 *
 * La forma corta se ancla al **mediodía UTC** del día elegido. Sin eso,
 * `new Date("2026-07-29")` es medianoche UTC y `formatDate` —que fija
 * `timeZone: "America/Bogota"` (UTC-5)— la renderiza como el **28** de julio: la
 * vista previa del crédito mostraba todas las cuotas corridas un día hacia
 * atrás. El mediodía cae en el mismo día de calendario en cualquier zona entre
 * UTC-11 y UTC+11. Espejo de `parseFechaInicio` del backend.
 */
export function parseFechaInicio(fechaInicio: string): Date {
  const soloFecha = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fechaInicio);
  if (!soloFecha) return new Date(fechaInicio);
  const [, anio, mes, dia] = soloFecha;
  return new Date(Date.UTC(Number(anio), Number(mes) - 1, Number(dia), 12));
}

function addDays(base: Date, days: number): Date {
  return new Date(base.getTime() + days * DIA_MS);
}

// Mismo día del mes N meses después, cayendo al último día si el mes destino no
// lo tiene (31 ene → 28 feb). Espejo de `addMonths` en
// `apps/api/src/core/domain/payment-schedule.util.ts`, y en **UTC** igual que
// él: las fechas del cronograma se anclan al mediodía UTC (ver
// `parseFechaInicio`) y se formatean fijando `America/Bogota`, así que mezclar
// getters locales acá reintroduciría el corrimiento de un día en zonas lejanas.
function addMonths(base: Date, months: number): Date {
  const dia = base.getUTCDate();
  const target = new Date(
    Date.UTC(
      base.getUTCFullYear(),
      base.getUTCMonth() + months,
      1,
      base.getUTCHours(),
      base.getUTCMinutes(),
      base.getUTCSeconds(),
      base.getUTCMilliseconds(),
    ),
  );
  const ultimoDiaDelMes = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  target.setUTCDate(Math.min(dia, ultimoDiaDelMes));
  return target;
}

/**
 * Fecha en la que vence la cuota `numeroCuota` (1-indexada): **la cuota 1 vence
 * un período DESPUÉS de `fechaInicio`** (el día del desembolso no se cobra), y
 * de ahí en adelante se avanza un período por cuota.
 *
 * Es una PROYECCIÓN de lectura, espejo de `fechaVencimientoCuota` del backend
 * (`core/domain/payment-schedule.util.ts`), que sigue siendo la autoridad: acá
 * no se decide mora ni se calcula dinero. Si el negocio empieza a saltarse
 * feriados, las dos funciones se cambian juntas.
 */
export function fechaVencimientoCuota(
  fechaInicio: string | Date,
  numeroCuota: number,
  frecuencia: FrecuenciaPago,
): Date {
  const base = typeof fechaInicio === "string" ? parseFechaInicio(fechaInicio) : fechaInicio;
  const periodos = numeroCuota;
  switch (frecuencia) {
    case "MENSUAL":
      return addMonths(base, periodos);
    case "SEMANAL":
      return addDays(base, periodos * 7);
    case "DIARIO":
    default:
      return addDays(base, periodos);
  }
}

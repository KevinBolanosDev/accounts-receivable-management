// Formateo de fecha y hora. Mismo patrón que `format-currency.ts`: instancias
// de `Intl` a nivel de módulo (crearlas por render es caro) y un único lugar
// donde se decide cómo se ve una fecha en toda la app.
//
// Antes de este módulo había 11 formateadores copiados en distintas pantallas,
// 4 formatos distintos y CERO renderizado de hora — pese a que `Pago.fecha`
// viaja como ISO completo. Un cobrador que registra dos abonos del mismo
// cliente el mismo día veía dos filas idénticas.
//
// `timeZone` FIJO a propósito: sin él `Intl` resuelve contra la zona del
// runtime, que es UTC en el server de Next y America/Bogota en el navegador →
// el HTML del SSR no coincide con el del cliente y React tira un error de
// hidratación. Con hora en pantalla el desfase serían 5 horas visibles, no un
// detalle.
export const APP_LOCALE = "es-CO";
export const APP_TIME_ZONE = "America/Bogota";

const dateFormatter = new Intl.DateTimeFormat(APP_LOCALE, {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: APP_TIME_ZONE,
});

const dateShortFormatter = new Intl.DateTimeFormat(APP_LOCALE, {
  day: "numeric",
  month: "short",
  timeZone: APP_TIME_ZONE,
});

const timeFormatter = new Intl.DateTimeFormat(APP_LOCALE, {
  hour: "numeric",
  minute: "2-digit",
  timeZone: APP_TIME_ZONE,
});

const dateTimeFormatter = new Intl.DateTimeFormat(APP_LOCALE, {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: APP_TIME_ZONE,
});

const dateTimeShortFormatter = new Intl.DateTimeFormat(APP_LOCALE, {
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
  timeZone: APP_TIME_ZONE,
});

// Para comparar "hoy"/"ayer" en la zona de la app, no en la del runtime.
const dayKeyFormatter = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: APP_TIME_ZONE,
});

export type DateInput = string | number | Date | null | undefined;

export const EMPTY_DATE = "—";

function toDate(value: DateInput): Date | null {
  if (value === null || value === undefined || value === "") return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

// `es-CO` agrega un punto al mes abreviado ("27 jul. 2026"). Se quita siempre
// acá en vez de repetir un `.replace()` en cada pantalla.
function clean(formatted: string): string {
  return formatted.replace(/\.(?=\s|,|$)/g, "");
}

function format(fmt: Intl.DateTimeFormat, value: DateInput, fallback: string): string {
  const date = toDate(value);
  return date ? clean(fmt.format(date)) : fallback;
}

/** "27 jul 2026" */
export function formatDate(value: DateInput, fallback = EMPTY_DATE): string {
  return format(dateFormatter, value, fallback);
}

/** "27 jul" — listas densas donde el año es ruido. */
export function formatDateShort(value: DateInput, fallback = EMPTY_DATE): string {
  return format(dateShortFormatter, value, fallback);
}

/** "3:42 p. m." */
export function formatTime(value: DateInput, fallback = EMPTY_DATE): string {
  return format(timeFormatter, value, fallback);
}

/** "27 jul 2026, 3:42 p. m." — recibos y detalles. */
export function formatDateTime(value: DateInput, fallback = EMPTY_DATE): string {
  return format(dateTimeFormatter, value, fallback);
}

/** "27 jul, 3:42 p. m." — el formato de las filas del historial de pagos. */
export function formatDateTimeShort(value: DateInput, fallback = EMPTY_DATE): string {
  return format(dateTimeShortFormatter, value, fallback);
}

export function isSameDay(a: DateInput, b: DateInput): boolean {
  const dateA = toDate(a);
  const dateB = toDate(b);
  if (!dateA || !dateB) return false;
  return dayKeyFormatter.format(dateA) === dayKeyFormatter.format(dateB);
}

export function isToday(value: DateInput): boolean {
  return isSameDay(value, new Date());
}

/**
 * "Hoy, 3:42 p. m." · "Ayer, 9:10 a. m." · "25 jul, 8:00 a. m."
 * Para historiales donde la mayoría de las filas son recientes.
 */
export function formatRelativeDateTime(value: DateInput, fallback = EMPTY_DATE): string {
  const date = toDate(value);
  if (!date) return fallback;

  const ayer = new Date();
  ayer.setDate(ayer.getDate() - 1);

  if (isToday(date)) return `Hoy, ${formatTime(date)}`;
  if (isSameDay(date, ayer)) return `Ayer, ${formatTime(date)}`;
  return formatDateTimeShort(date);
}

// Fase 5 — límites de un "día calendario" en una zona horaria arbitraria.
// Cero I/O, sin conocer nada del dominio del cierre (esa política vive en
// `core/reports/closure-policy.ts`, que la importa): es el único lugar donde
// se hace aritmética de zona horaria, para que `daily-closure.util.ts` y
// cualquier otro consumidor futuro no dupliquen el cálculo.
//
// `Pago.fecha` se guarda en UTC; el "día" contable es el de la zona local. Un
// cobro a las 23:30 en `America/Bogota` (04:30 UTC del día siguiente) tiene
// que caer en el día local correcto — de ahí que todo pase por acá en vez de
// comparar `Date`s a mano en cada service.

interface LocalParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

// Lectura COMPLETA (con hora) del reloj de `tz` en el instante `date`. La
// clave pública (`localDateKey`) solo expone Y-M-D, pero `zonedMidnightToUtc`
// necesita también hora/minuto/segundo: un offset como el de Bogotá (-5h) no
// es un número de DÍAS, es un número de HORAS, y quedarse solo con la fecha
// pierde justo esa parte — 00:00 UTC del día N cae en la TARDE del día N-1 en
// Bogotá, no a las 00:00 del día N-1.
function localParts(date: Date, tz: string): LocalParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
    second: get("second"),
  };
}

/** "YYYY-MM-DD" del día calendario que `date` representa en `tz`. */
export function localDateKey(date: Date, tz: string): string {
  const { year, month, day } = localParts(date, tz);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * Instante UTC real que corresponde a `year-month-day 00:00:00` EN `tz`.
 *
 * Truco estándar sin librería de zonas horarias: arma el instante como si
 * `year-month-day 00:00:00` ya fuera UTC (ingenuo), pregunta qué hora marca
 * `tz` en ESE instante (con hora, no solo fecha), y la diferencia entre lo
 * pedido y lo leído es el offset real de `tz` en esa fecha (contempla DST si
 * la zona lo tuviera). Restar el offset del instante ingenuo da el instante
 * UTC correcto.
 */
function zonedMidnightToUtc(year: number, month: number, day: number, tz: string): Date {
  const naive = Date.UTC(year, month - 1, day, 0, 0, 0);
  const leido = localParts(new Date(naive), tz);
  const leidoComoUtc = Date.UTC(
    leido.year,
    leido.month - 1,
    leido.day,
    leido.hour,
    leido.minute,
    leido.second,
  );
  const offset = leidoComoUtc - naive;
  return new Date(naive - offset);
}

function nextCalendarDay(
  year: number,
  month: number,
  day: number,
): { year: number; month: number; day: number } {
  const next = new Date(Date.UTC(year, month - 1, day + 1));
  return { year: next.getUTCFullYear(), month: next.getUTCMonth() + 1, day: next.getUTCDate() };
}

/**
 * Medianoche LOCAL del día calendario en el que cae `date`, expresada como el
 * instante UTC real que le corresponde. Es lo que se persiste en la columna
 * `date` (`@db.Date`) de `DailyClosure`: Postgres solo guarda el día
 * calendario (sin hora), así que lo único que importa es que este instante
 * caiga del lado correcto de la medianoche UTC — `zonedMidnightToUtc` lo
 * garantiza para cualquier `tz`.
 */
export function startOfLocalDay(date: Date, tz: string): Date {
  const { year, month, day } = localParts(date, tz);
  return zonedMidnightToUtc(year, month, day, tz);
}

/**
 * Rango `[start, end)` en UTC del día calendario de `date` en `tz` — para
 * filtrar `Pago.fecha` (guardado en UTC) por "qué pagos caen en este día
 * local". `end` es la medianoche local del día SIGUIENTE (no `start + 24h`
 * a secas): en una zona con horario de verano un día puede durar 23 o 25
 * horas. `America/Bogota` no tiene DST, pero la función queda correcta para
 * cualquier zona igual.
 */
export function dayRange(date: Date, tz: string): { start: Date; end: Date } {
  const { year, month, day } = localParts(date, tz);
  const start = zonedMidnightToUtc(year, month, day, tz);
  const next = nextCalendarDay(year, month, day);
  const end = zonedMidnightToUtc(next.year, next.month, next.day, tz);
  return { start, end };
}

/**
 * `date` acá es un valor ya "día calendario puro" — un `@db.Date` leído de
 * Postgres (o `startOfLocalDay(...)` antes de persistir) — no un instante
 * cualquiera. Postgres `DATE` no tiene zona horaria: Prisma lo devuelve como
 * medianoche UTC de ese día, así que su día calendario se lee DIRECTO en UTC,
 * sin volver a pasar por `tz` (eso sería tratar un día como si fuera un
 * instante y convertirlo de nuevo, doble contabilidad del offset).
 */
export function utcDateKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(
    date.getUTCDate(),
  ).padStart(2, "0")}`;
}

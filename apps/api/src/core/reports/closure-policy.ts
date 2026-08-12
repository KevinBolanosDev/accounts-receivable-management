// Fase 5 — constantes del cierre diario. Único lugar donde vive la zona
// horaria del "día contable": `core/domain/daily-closure.util.ts` y
// `core/domain/day-boundary.util.ts` (genérico, sin conocer esta política) se
// componen a partir de acá, nunca al revés.
export const CLOSURE_TIMEZONE = "America/Bogota"; // UTC-5, consistente con Intl es-CO/COP
export const DAILY_CLOSURE_CRON = "0 22 * * *"; // 22:00 local (solo si el cron se habilita)

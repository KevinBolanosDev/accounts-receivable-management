import { z } from "zod";

export const closureStatusSchema = z.enum(["OPEN", "CLOSED"]);
export type ClosureStatus = z.infer<typeof closureStatusSchema>;

export const unpaidClientSchema = z.object({
  clienteId: z.string(),
  nombre: z.string(),
  saldoPendiente: z.number(),
  // Para "Llamar"/"Recordar" desde el detalle del cierre (#13c) — el
  // snapshot congelado necesita su propia copia, `Cliente.telefono` puede
  // cambiar después del cierre.
  telefono: z.string().nullable(),
});
export type UnpaidClient = z.infer<typeof unpaidClientSchema>;

// Un cliente puede pagar más de una cuota el mismo día (poco común, pero
// pasa) — una fila por PAGO, no por cliente, a diferencia de `unpaidClient`
// (ahí "sin pagar" sí es un hecho por cliente).
export const closurePaymentSchema = z.object({
  clienteId: z.string(),
  clienteNombre: z.string(),
  numeroCuota: z.number().int(),
  monto: z.number(),
});
export type ClosurePayment = z.infer<typeof closurePaymentSchema>;

// Resumen en vivo ANTES de cerrar (#19c). Se calcula, no se persiste.
export const closurePreviewSchema = z.object({
  routeId: z.string(),
  rutaNombre: z.string(),
  date: z.string(),
  totalCollected: z.number(),
  collectedCount: z.number().int(),
  newCredits: z.number().int(),
  newCreditsAmount: z.number(),
  productsSold: z.number().int(),
  unpaidClients: unpaidClientSchema.array(),
  alreadyClosed: z.boolean(), // true si ya existe cierre para (ruta, hoy)
});
export type ClosurePreview = z.infer<typeof closurePreviewSchema>;

// Snapshot congelado (#13c detalle). Inmutable: el histórico lee esto, no recalcula.
export const dailyClosureSchema = z.object({
  id: z.string(),
  routeId: z.string(),
  rutaNombre: z.string(),
  date: z.string(),
  totalCollected: z.number(),
  collectedCount: z.number().int(),
  newCredits: z.number().int(),
  newCreditsAmount: z.number(),
  productsSold: z.number().int(),
  unpaidClients: unpaidClientSchema.array(),
  unpaidCount: z.number().int(),
  // `null` = cierre de antes de que este campo existiera (no se recalcula,
  // es un snapshot inmutable) — el front lo distingue de "nadie pagó ese
  // día". Nace `.nullable()` en vez de `.optional()` porque el backend
  // siempre manda la llave (con `null` adentro), nunca la omite.
  paidClients: closurePaymentSchema.array().nullable().default(null),
  status: closureStatusSchema,
  closedByNombre: z.string().nullable(),
  createdAt: z.string(),
});
export type DailyClosure = z.infer<typeof dailyClosureSchema>;

// Fila del histórico (#12c) — sin las listas pesadas de clientes.
export const dailyClosureListItemSchema = dailyClosureSchema.omit({
  unpaidClients: true,
  paidClients: true,
});
export type DailyClosureListItem = z.infer<typeof dailyClosureListItemSchema>;

export const dailyClosureListQuerySchema = z.object({
  routeId: z.string().optional(),
  from: z.string().optional(), // YYYY-MM-DD
  to: z.string().optional(),
});
export type DailyClosureListQuery = z.infer<typeof dailyClosureListQuerySchema>;

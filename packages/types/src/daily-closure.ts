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
  status: closureStatusSchema,
  closedByNombre: z.string().nullable(),
  createdAt: z.string(),
});
export type DailyClosure = z.infer<typeof dailyClosureSchema>;

// Fila del histórico (#12c) — sin la lista pesada de clientes.
export const dailyClosureListItemSchema = dailyClosureSchema.omit({ unpaidClients: true });
export type DailyClosureListItem = z.infer<typeof dailyClosureListItemSchema>;

export const dailyClosureListQuerySchema = z.object({
  routeId: z.string().optional(),
  from: z.string().optional(), // YYYY-MM-DD
  to: z.string().optional(),
});
export type DailyClosureListQuery = z.infer<typeof dailyClosureListQuerySchema>;

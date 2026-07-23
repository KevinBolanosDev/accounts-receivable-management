import { z } from "zod";

import { pagoSchema } from "./cobro";

export const estadoCreditoSchema = z.enum(["ACTIVO", "PAGADO", "MORA", "ANULADO"]);
export type EstadoCredito = z.infer<typeof estadoCreditoSchema>;

export const creditoSchema = z.object({
  id: z.string(),
  codigo: z.string(),
  clienteId: z.string(),
  productoId: z.string(),
  montoTotal: z.number(),
  cuotaDiaria: z.number(),
  saldoPendiente: z.number(),
  totalPagado: z.number(),
  porcentajePagado: z.number(),
  estado: estadoCreditoSchema,
  fechaInicio: z.string(),
});
export type Credito = z.infer<typeof creditoSchema>;

export const creditoListItemSchema = creditoSchema.extend({
  producto: z.object({ id: z.string(), nombre: z.string() }),
  cuotasPagadas: z.number().int(),
  cuotasTotal: z.number().int(),
});
export type CreditoListItem = z.infer<typeof creditoListItemSchema>;

export const creditoDetailSchema = creditoListItemSchema.extend({
  cliente: z.object({ id: z.string(), nombre: z.string() }),
  pagos: z.array(pagoSchema),
});
export type CreditoDetail = z.infer<typeof creditoDetailSchema>;

export const createCreditoRequestSchema = z.object({
  clienteId: z.string().min(1, "Selecciona un cliente."),
  productoId: z.string().min(1, "Selecciona un producto."),
  montoTotal: z.number().positive("El monto total debe ser mayor a 0."),
  cuotaDiaria: z.number().positive("La cuota diaria debe ser mayor a 0."),
  fechaInicio: z.string().optional(),
});
export type CreateCreditoRequest = z.infer<typeof createCreditoRequestSchema>;

export const updateCreditoRequestSchema = z.object({
  productoId: z.string().optional(),
  montoTotal: z.number().positive().optional(),
  cuotaDiaria: z.number().positive().optional(),
});
export type UpdateCreditoRequest = z.infer<typeof updateCreditoRequestSchema>;

export const creditosQuerySchema = z.object({
  clienteId: z.string().optional(),
  estado: estadoCreditoSchema.optional(),
});
export type CreditosQuery = z.infer<typeof creditosQuerySchema>;

export const cobroResponseSchema = z.object({
  pago: pagoSchema,
  // El crédito recalculado se devuelve en su forma completa
  // (producto + cuotasPagadas/cuotasTotal) para que el front (16c) pueda
  // pintar el CreditCard sin un round-trip extra.
  credito: creditoListItemSchema,
});
export type CobroResponse = z.infer<typeof cobroResponseSchema>;

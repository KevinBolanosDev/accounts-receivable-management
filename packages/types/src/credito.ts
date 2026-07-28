import { z } from "zod";

import { pagoSchema } from "./payment";

export const estadoCreditoSchema = z.enum(["ACTIVO", "PAGADO", "MORA", "ANULADO"]);
export type EstadoCredito = z.infer<typeof estadoCreditoSchema>;

// Crédito expuesto. Los derivados (montoTotal, cuotaDiaria, saldoPendiente,
// totalPagado, porcentajePagado, estado) los CALCULA el service; no se editan
// ni se envían desde el cliente. `producto` es texto libre: el nombre del
// producto, que el service registra en el catálogo (upsert por nombre) al crear
// el crédito (inventario, ver 3.6). El precio de la venta vive en `monto`.
export const creditoSchema = z.object({
  id: z.string(),
  codigo: z.string(), // legible y único: CR-XXXX (generado en el service, ver 3.8)
  clienteId: z.string(),
  producto: z.string(), // nombre libre (registrado en el catálogo por upsert)
  monto: z.number(), // capital del crédito (sin interés)
  interes: z.number(), // % de interés sobre el capital
  dias: z.number().int(), // plazo en días = número de cuotas diarias
  montoTotal: z.number(), // derivado = monto + monto * interes / 100
  cuotaDiaria: z.number(), // derivado = montoTotal / dias
  saldoPendiente: z.number(), // calculado (materializado)
  totalPagado: z.number(), // calculado = montoTotal - saldoPendiente
  porcentajePagado: z.number(), // calculado
  estado: estadoCreditoSchema, // calculado
  fechaInicio: z.string(),
});
export type Credito = z.infer<typeof creditoSchema>;

// Fila/resumen para las pestañas Activo/Historial del cliente (5c).
export const creditoListItemSchema = creditoSchema.extend({
  cuotasPagadas: z.number().int(),
  cuotasTotal: z.number().int(), // = dias (una cuota diaria por día)
});
export type CreditoListItem = z.infer<typeof creditoListItemSchema>;

// Detalle (10a): crédito + su historial de pagos.
export const creditoDetailSchema = creditoListItemSchema.extend({
  cliente: z.object({
    id: z.string(),
    nombre: z.string(),
    ruta: z.object({ id: z.string(), nombre: z.string() }).nullable(),
  }),
  pagos: z.array(pagoSchema),
});
export type CreditoDetail = z.infer<typeof creditoDetailSchema>;

// Alta: el cliente envía capital (`monto`) + `interes` (%) + `dias` + `producto`
// (texto libre). El server registra el producto (upsert por nombre) y DERIVA
// montoTotal, cuotaDiaria y saldoPendiente. `cuotaDiaria` NO se envía (se calcula).
export const createCreditoRequestSchema = z.object({
  clienteId: z.string().min(1, "Selecciona un cliente."),
  producto: z.string().min(1, "Escribe el producto."),
  monto: z.number().positive("El monto debe ser mayor a 0."),
  interes: z.number().min(0, "El interés no puede ser negativo."),
  dias: z.number().int().positive("Los días deben ser mayor a 0."),
  fechaInicio: z.string().optional(), // el server usa hoy si no viene
});
export type CreateCreditoRequest = z.infer<typeof createCreditoRequestSchema>;

// Editar solo mientras el crédito NO tenga pagos (regla del service → 409 si los tiene).
export const updateCreditoRequestSchema = z.object({
  producto: z.string().min(1).optional(),
  monto: z.number().positive().optional(),
  interes: z.number().min(0).optional(),
  dias: z.number().int().positive().optional(),
});
export type UpdateCreditoRequest = z.infer<typeof updateCreditoRequestSchema>;

export const creditosQuerySchema = z.object({
  clienteId: z.string().optional(),
  estado: estadoCreditoSchema.optional(),
});
export type CreditosQuery = z.infer<typeof creditosQuerySchema>;

// NOTA: `cobroResponseSchema` y `CobroResponse` viven en `./cobro` desde
// Fase 4.8 (incluyen `recibo: ReciboInfo`). La app/web los importa desde el
// barrel `index.ts`, que reexporta `./cobro`.

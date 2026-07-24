import { z } from "zod";

import { creditoListItemSchema } from "./credito";

export const pagoSchema = z.object({
  id: z.string(),
  creditoId: z.string(),
  monto: z.number(),
  fecha: z.string(),
  cobradorId: z.string(),
  cobradorNombre: z.string().nullable().optional(), // nombre del cobrador (columna del detalle #10a)
  reciboUrl: z.string().url().nullable(),
});
export type Pago = z.infer<typeof pagoSchema>;

export const createCobroRequestSchema = z.object({
  creditoId: z.string().min(1, "Selecciona el crédito al que aplica el pago."),
  monto: z.number().positive("El monto debe ser mayor a 0."),
});
export type CreateCobroRequest = z.infer<typeof createCobroRequestSchema>;

// Fase 4 — recibo embebido en la respuesta del cobro. El back construye la
// URL pública del recibo HTML (que sirve en `GET /payments/:pagoId/receipt`)
// y un código legible (`R-<pagoId-short>`). El front guarda la URL para
// "Compartir por WhatsApp" y el código para mostrarlo en la pantalla #18c.
export const reciboInfoSchema = z.object({
  url: z.string().url(),
  codigo: z.string(),
});
export type ReciboInfo = z.infer<typeof reciboInfoSchema>;

export const cobroResponseSchema = z.object({
  pago: pagoSchema,
  credito: creditoListItemSchema,
  recibo: reciboInfoSchema,
});
export type CobroResponse = z.infer<typeof cobroResponseSchema>;

import { z } from "zod";

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

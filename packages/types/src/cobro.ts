import { z } from "zod";

import { creditoListItemSchema } from "./credito";
import { pagoSchema } from "./payment";

// `pagoSchema`/`Pago` viven en `./payment` (hoja) desde el fix del ciclo de
// imports. NO se re-exportan desde acá: el barrel ya hace `export * from
// "./payment"`, y re-exportarlos también desde este módulo volvería el nombre
// ambiguo entre dos `export *`.

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
  // Enlace público con token firmado (`GET /r/:token`) — es el que se comparte
  // por WhatsApp. `url` exige JWT de staff: mandarla al cliente daría 401.
  // Optional para no romper respuestas de un backend anterior al cambio.
  publicUrl: z.string().url().optional(),
});
export type ReciboInfo = z.infer<typeof reciboInfoSchema>;

export const cobroResponseSchema = z.object({
  pago: pagoSchema,
  credito: creditoListItemSchema,
  recibo: reciboInfoSchema,
});
export type CobroResponse = z.infer<typeof cobroResponseSchema>;

// Respuesta de anular un pago (`DELETE /collections/:pagoId`). Sin `recibo`
// a propósito: anular no genera uno nuevo — el recibo del pago original
// sigue existiendo tal cual (para no perder el rastro de que existió), el
// HTML server-rendered simplemente lo mostrará marcado como anulado.
export const anularPagoResponseSchema = z.object({
  pago: pagoSchema,
  credito: creditoListItemSchema,
});
export type AnularPagoResponse = z.infer<typeof anularPagoResponseSchema>;

import { z } from "zod";

// Fase 4 — recibo de pago. Vista de solo lectura con los datos que el cliente
// final ve al abrir el recibo. El ID del recibo es el ID del Pago (1:1 — no
// hay tabla separada, derivamos el código del recibo a partir del pagoId).
// El HTML server-rendered del back (`ReceiptsService.buildHtml`) usa el
// mismo shape para no desincronizarse.
//
// NOTA: `cobroResponseSchema` y `reciboInfoSchema` viven en `./cobro` (donde
// se reutilizan para el response del endpoint `POST /collections`); este
// archivo solo agrega el shape completo del recibo, `Receipt`.
export const receiptSchema = z.object({
  id: z.string(),
  pagoId: z.string(),
  codigo: z.string(),
  createdAt: z.string(),
  credito: z.object({
    codigo: z.string(),
    clienteNombre: z.string(),
    productoNombre: z.string(),
  }),
  monto: z.number(),
  saldoRestante: z.number(),
  fecha: z.string(),
  cobradorNombre: z.string(),
});
export type Receipt = z.infer<typeof receiptSchema>;
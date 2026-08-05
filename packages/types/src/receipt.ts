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
  // Enlace público firmado (`/r/:token`) y teléfono del cliente — lo que le
  // falta a este shape para armar el mensaje de WhatsApp sin otro round-trip.
  // `.optional()` porque son campos nuevos de respuesta (lector tolerante,
  // ver CLAUDE.md raíz): el HTML server-rendered nunca los necesitó y no
  // todos los llamadores de `loadReceipt` los completan.
  reciboPublicUrl: z.string().url().nullable().optional(),
  clienteTelefono: z.string().nullable().optional(),
  // El pago detrás de este recibo fue anulado DESPUÉS de compartirlo. El
  // enlace (`/r/:token`, 90 días) sigue siendo válido — el HTML lo marca
  // como anulado en vez de seguir mostrando el pago como vigente, para que
  // quien abra un link viejo no crea que esa plata sigue contando.
  anulado: z.boolean().default(false),
});
export type Receipt = z.infer<typeof receiptSchema>;
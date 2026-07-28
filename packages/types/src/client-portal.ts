import { z } from "zod";

import { creditoListItemSchema } from "./credito";
import { paymentHistoryItemSchema } from "./payment-history";

// `cuotaEstadoSchema` y `paymentHistoryItemSchema` se mudaron a
// `./payment-history` cuando el historial dejó de ser exclusivo del portal (lo
// consume también el detalle de crédito del Cobrador). El barrel `index.ts` los
// exporta desde allá; acá solo se usan para componer el detalle.

// Fila de la lista "Mis créditos" — extiende CreditoListItem con la fecha de
// la próxima cuota esperada (null si el crédito ya está PAGADO/ANULADO).
export const clientCreditListItemSchema = creditoListItemSchema.extend({
  proximaFechaCuota: z.string().nullable(),
});
export type ClientCreditListItem = z.infer<typeof clientCreditListItemSchema>;

// Detalle de #21c — extiende `clientCreditListItemSchema` (no `CreditoDetail`:
// ese hereda de `creditoListItemSchema`, sin `proximaFechaCuota`) con
// `cliente` y `pagos` enriquecidos.
export const clientCreditDetailSchema = clientCreditListItemSchema.extend({
  cliente: z.object({
    id: z.string(),
    nombre: z.string(),
    ruta: z.object({ id: z.string(), nombre: z.string() }).nullable(),
  }),
  pagos: paymentHistoryItemSchema.array(),
});
export type ClientCreditDetail = z.infer<typeof clientCreditDetailSchema>;

// Resumen agregado del portal (hero de "Mis créditos" y de #21c individual).
export const clientCreditSummarySchema = z.object({
  saldoTotal: z.number(),
  proximaCuota: z.number().nullable(),
  porcentajePagado: z.number(),
  creditosActivos: z.number().int(),
});
export type ClientCreditSummary = z.infer<typeof clientCreditSummarySchema>;

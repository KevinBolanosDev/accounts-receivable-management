import { z } from "zod";

import { pagoSchema } from "./payment";

// Historial de cuotas enriquecido. Nació en Fase 4 dentro de `client-portal.ts`
// (solo lo consumía el portal), pero desde el historial modular del Cobrador lo
// consumen las DOS superficies, así que vive en su propio módulo neutral.
// `client-portal.ts` lo re-exporta por compatibilidad.
//
// Valores en inglés (no hereda el precedente en español de
// `estadoCreditoSchema`, que es deuda anterior).
//
// Pagadas:  ON_TIME (al día o antes) · LATE (se pagó después de su fecha)
// Sin pagar: PENDING (vence hoy, todavía se puede cobrar)
//            OVERDUE (venció, menos de una semana) → "Vencida", ámbar
//            DEFAULTED (venció hace una semana o más) → "Mora", rojo
//
// Antes había un solo estado `MISSED` para todo lo no pagado, así que una cuota
// que vencía hoy se veía igual de mal que una de hace un mes.
export const cuotaEstadoSchema = z.enum([
  "ON_TIME",
  "LATE",
  "PENDING",
  "OVERDUE",
  "DEFAULTED",
]);
export type CuotaEstado = z.infer<typeof cuotaEstadoSchema>;

// Días de atraso a partir de los cuales una cuota vencida pasa de "Vencida" a
// "Mora". Vive en el contrato porque lo aplica el backend y lo explica el front.
export const DIAS_PARA_MORA = 7;

// Fila del historial de pagos (#21c y el detalle de crédito del Cobrador).
// Las cuotas sin pagar son filas sintéticas (no hay un `Pago` detrás): `id`
// sintético, `monto` = 0, `fechaPago` = null y `reciboCodigo`/`reciboPublicUrl`
// = null (no hay recibo que mostrar ni que compartir).
export const paymentHistoryItemSchema = pagoSchema.extend({
  numeroCuota: z.number().int(),
  estado: cuotaEstadoSchema,
  // Cuándo TOCABA pagar la cuota. Siempre presente.
  fechaVencimiento: z.string(),
  // Cuándo se pagó DE VERDAD (null si aún no). Se separa de `fechaVencimiento`
  // a propósito: son dos datos distintos y antes la tabla los mezclaba en una
  // sola columna `fecha` — en las filas pagadas mostraba la fecha de pago y en
  // las no pagadas la de vencimiento, sin decir cuál era cuál.
  fechaPago: z.string().nullable(),
  // Días de atraso al pagar (0 si fue a tiempo); en las no pagadas, días desde
  // que venció. Es lo que decide OVERDUE vs DEFAULTED.
  diasAtraso: z.number().int(),
  reciboCodigo: z.string().nullable(),
  // Enlace público con token firmado (`GET /r/:token`). Es lo que se manda por
  // WhatsApp: `reciboUrl` exige JWT de staff y le daría 401 al cliente.
  // Nullable/optional: las filas MISSED no tienen recibo, y así el contrato
  // tolera un backend que todavía no lo puebla.
  reciboPublicUrl: z.string().url().nullable().optional(),
});
export type PaymentHistoryItem = z.infer<typeof paymentHistoryItemSchema>;

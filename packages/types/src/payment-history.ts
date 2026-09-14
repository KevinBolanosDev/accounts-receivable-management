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
//
// ANULADO: el pago se registró y después se anuló (error de tipeo, cuota
// equivocada). Es una fila de AUDITORÍA — no ocupa un lugar en el cronograma
// (su `numeroCuota` es 0, ver `buildPaymentHistory`) y el período que
// "liberó" vuelve a aparecer como pendiente en una fila aparte.
export const cuotaEstadoSchema = z.enum([
  "ON_TIME",
  "LATE",
  "PENDING",
  "OVERDUE",
  "DEFAULTED",
  "ANULADO",
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
  // `0` = fila de auditoría (estado `ANULADO`): no ocupa un número real del
  // cronograma, así que "Cuota 0/N" nunca debe renderizarse — la UI la
  // distingue por `estado`, no por este valor.
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
  // Cobertura de este pago en cuotas (dinero acumulado ÷ valor de cuota, no
  // "1 pago = 1 cuota" — ver el comentario grande en `buildPaymentHistory`).
  // `.default(...)` porque son campos nuevos de respuesta (lector tolerante,
  // ver CLAUDE.md raíz): un front desplegado contra un backend que todavía no
  // los manda tiene que seguir renderizando el historial.
  /** Cuántas cuotas COMPLETAS aportó este pago en particular (0 = abono parcial). */
  cuotasCubiertas: z.number().int().default(1),
  /** Cuántas cuotas COMPLETAS hay cubiertas con la plata acumulada hasta este pago inclusive. */
  cuotasCubiertasAcumuladas: z.number().int().default(0),
  /** Lo que sobra sin alcanzar a completar una cuota nueva. */
  saldoAFavor: z.number().default(0),
  /** Qué % de la próxima cuota ya cubre `saldoAFavor`. */
  porcentajeProximaCuota: z.number().default(0),
});
export type PaymentHistoryItem = z.infer<typeof paymentHistoryItemSchema>;

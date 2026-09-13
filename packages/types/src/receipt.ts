import { z } from "zod";

import { frecuenciaPagoSchema } from "./credito";
import { cuotaEstadoSchema } from "./payment-history";

// Fase 4 — recibo de pago. Vista de solo lectura con los datos que el cliente
// final ve al abrir el recibo. El ID del recibo es el ID del Pago (1:1 — no
// hay tabla separada, derivamos el código del recibo a partir del pagoId).
// El PDF que sirve el back (`receipt-pdf.ts`) usa el mismo shape para no
// desincronizarse.
//
// NOTA: `cobroResponseSchema` y `reciboInfoSchema` viven en `./cobro` (donde
// se reutilizan para el response del endpoint `POST /collections`); este
// archivo solo agrega el shape completo del recibo, `Receipt`.
//
// Grafo de imports (ver el gotcha de ciclos en CLAUDE.md raíz): este módulo
// importa de `credito` y `payment-history`, los dos AGUAS ARRIBA suyo en
// `index.ts`, y ninguno importa `receipt` de vuelta. No introduce ciclo.

// Una cuota ya pagada, tal como se lista en el registro del recibo. Es un
// subconjunto plano de `PaymentHistoryItem` — solo lo que el recibo imprime,
// sin ids ni enlaces (el registro es para leer, no para navegar).
export const receiptInstallmentSchema = z.object({
  numeroCuota: z.number().int(),
  monto: z.number(),
  fechaPago: z.string(),
  estado: cuotaEstadoSchema,
});
export type ReceiptInstallment = z.infer<typeof receiptInstallmentSchema>;

export const receiptSchema = z.object({
  id: z.string(),
  pagoId: z.string(),
  codigo: z.string(),
  createdAt: z.string(),
  credito: z.object({
    codigo: z.string(),
    clienteNombre: z.string(),
    productoNombre: z.string(),
    // Términos del crédito. Campos nuevos de RESPUESTA ⇒ nacen con
    // `.default(...)` (lector tolerante, ver CLAUDE.md raíz): un front
    // desplegado contra un backend que todavía no los manda tiene que
    // seguir renderizando el recibo, no romper con ZodError.
    capital: z.number().default(0),
    interes: z.number().default(0),
    montoTotal: z.number().default(0),
    /**
     * Valor de UNA cuota. Se llama `cuotaValor` y no `cuotaDiaria` a
     * propósito: el contrato viejo arrastra ese nombre por compatibilidad
     * (ver `credito.ts`), pero acá el campo nace hoy y no hay razón para
     * heredar un nombre que miente cuando la frecuencia es semanal o mensual.
     */
    cuotaValor: z.number().default(0),
    /** Total de cuotas del plan. */
    cuotas: z.number().int().default(0),
    frecuencia: frecuenciaPagoSchema.default("DIARIO"),
  }),
  monto: z.number(),
  saldoRestante: z.number(),
  fecha: z.string(),
  cobradorNombre: z.string(),
  // === Estado del crédito AL MOMENTO DE ESTE PAGO ==========================
  // Nunca "a hoy". Un recibo es el comprobante de un instante: si el enlace
  // (`/r/:token`, 90 días) se abre tres meses después tiene que seguir
  // diciendo lo mismo que el día que se emitió. Es la misma disciplina que
  // ya usa `saldoRestante`, que suma de vuelta los pagos POSTERIORES en vez
  // de leer el saldo actual del crédito.
  /** Qué número de cuota saldó este pago. `0` si el pago está anulado (no ocupa lugar en el cronograma). */
  numeroCuota: z.number().int().default(0),
  cuotasPagadas: z.number().int().default(0),
  cuotasRestantes: z.number().int().default(0),
  /** Las cuotas pagadas hasta ESTE pago inclusive, en orden cronológico. */
  cuotasPagadasDetalle: z.array(receiptInstallmentSchema).default([]),
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
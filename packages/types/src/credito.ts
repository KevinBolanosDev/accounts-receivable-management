import { z } from "zod";

import { pagoSchema } from "./payment";

export const estadoCreditoSchema = z.enum(["ACTIVO", "PAGADO", "MORA", "ANULADO"]);
export type EstadoCredito = z.infer<typeof estadoCreditoSchema>;

// Cada cuánto vence una cuota. El cálculo del dinero es idéntico en las tres
// (`montoTotal / cuotas`); lo único que cambia es el paso del calendario con el
// que se proyectan los vencimientos — ver `core/domain/payment-schedule.util.ts`.
// `DIARIO` es el default histórico: todos los créditos anteriores a esta
// frecuencia son diarios.
export const frecuenciaPagoSchema = z.enum(["DIARIO", "SEMANAL", "MENSUAL"]);
export type FrecuenciaPago = z.infer<typeof frecuenciaPagoSchema>;

// Días NOMINALES de cada período. Sirve para estimar el plazo total y ordenar,
// nunca para calcular un vencimiento real: en `MENSUAL` el vencimiento cae el
// mismo día del mes siguiente (28-31 días reales), no a los 30 exactos.
export const DIAS_POR_FRECUENCIA: Record<FrecuenciaPago, number> = {
  DIARIO: 1,
  SEMANAL: 7,
  MENSUAL: 30,
};

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
  // `.default("DIARIO")` y no requerido: un backend anterior a la frecuencia de
  // pago no manda este campo, y el front valida TODA respuesta con este mismo
  // schema. Sin el default, apuntar el front a una API vieja (o desplegar el
  // front antes que el back) hacía que `clienteDetailSchema.parse` lanzara
  // `ZodError` en cada crédito, y las pantallas lo mostraban como "este cliente
  // no existe". El valor es además el correcto: todo crédito previo es diario.
  frecuencia: frecuenciaPagoSchema.default("DIARIO"),
  // Plazo NOMINAL en días = cuotas * DIAS_POR_FRECUENCIA. Se conserva porque es
  // la columna histórica del modelo y sirve como orden de magnitud del plazo;
  // el cronograma real se proyecta con `frecuencia` + el número de cuotas
  // (`cuotasTotal` en las filas), nunca con esto.
  dias: z.number().int(),
  montoTotal: z.number(), // derivado = monto + monto * interes / 100
  // Valor de UNA cuota = montoTotal / cuotas. El nombre es histórico (nació
  // cuando el negocio solo tenía cobro diario); hoy es la cuota del período que
  // fije `frecuencia`. La UI la titula según la frecuencia, no "diaria" fijo.
  cuotaDiaria: z.number(),
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
  // EL número de cuotas del plan. No hay un `cuotas` aparte en la respuesta a
  // propósito: este campo ya existía (cuando todo era diario valía `dias`) y lo
  // consume toda la UI, así que duplicarlo solo abría la puerta a que los dos
  // se desincronizaran. El request SÍ usa `cuotas` — ahí es un input, no un
  // derivado. Todos los handlers de `creditos` responden con este schema
  // (incluido `POST /credits`, aunque su tipo declarado sea `Credito`).
  cuotasTotal: z.number().int(),
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

// Alta: el cliente envía capital (`monto`) + `interes` (%) + `frecuencia` +
// `cuotas` + `producto` (texto libre). El server registra el producto (upsert
// por nombre) y DERIVA montoTotal, cuotaDiaria, dias y saldoPendiente.
// `cuotaDiaria` NO se envía (se calcula), y `dias` tampoco: es el plazo nominal
// que sale de `frecuencia * cuotas`.
export const createCreditoRequestSchema = z.object({
  clienteId: z.string().min(1, "Selecciona un cliente."),
  producto: z.string().min(1, "Escribe el producto."),
  monto: z.number().positive("El monto debe ser mayor a 0."),
  interes: z.number().min(0, "El interés no puede ser negativo."),
  // Default en el schema (no en el front): un body sin `frecuencia` sigue
  // creando un crédito diario, que es el comportamiento anterior.
  frecuencia: frecuenciaPagoSchema.default("DIARIO"),
  cuotas: z.number().int().positive("Las cuotas deben ser mayor a 0."),
  fechaInicio: z.string().optional(), // el server usa hoy si no viene
});
export type CreateCreditoRequest = z.infer<typeof createCreditoRequestSchema>;

// Editar solo mientras el crédito NO tenga pagos (regla del service → 409 si los tiene).
export const updateCreditoRequestSchema = z.object({
  producto: z.string().min(1).optional(),
  monto: z.number().positive().optional(),
  interes: z.number().min(0).optional(),
  frecuencia: frecuenciaPagoSchema.optional(),
  cuotas: z.number().int().positive().optional(),
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

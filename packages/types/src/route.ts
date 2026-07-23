import { z } from "zod";

import { clienteListItemSchema } from "./client";

// Estado del día de la ruta (cierre diario). Es dato de Cierre → Fase 5;
// en la Fase 2 lo provee el mock.
export const estadoDiaRutaSchema = z.enum(["abierta", "cerrada"]);
export type EstadoDiaRuta = z.infer<typeof estadoDiaRutaSchema>;

// Ruta expuesta al frontend. La asignación cobrador↔ruta vive aquí
// (`cobradorId`), no en una tabla puente: un cobrador tiene 0..N rutas.
export const rutaSchema = z.object({
  id: z.string(),
  nombre: z.string(),
  activa: z.boolean(),
  cobradorId: z.string().nullable(),
});
export type Ruta = z.infer<typeof rutaSchema>;

// Fila de la tabla (pantalla 6c) y tarjeta de "Mis rutas" (#cobrador). El
// backend calcula `totalCobradoHoy`/`avanceDelDia` en tiempo real a partir de
// los Pagos del día (Fase 3); `estadoDia` sigue en "abierta" fijo hasta el
// cierre diario (Fase 5).
export const rutaListItemSchema = rutaSchema.extend({
  cobrador: z.object({ id: z.string(), nombre: z.string() }).nullable(),
  clientesCount: z.number().int(),
  totalCobradoHoy: z.number(),
  avanceDelDia: z.number(),
  estadoDia: estadoDiaRutaSchema,
});
export type RutaListItem = z.infer<typeof rutaListItemSchema>;

// Resumen de un cierre diario en el histórico (pantalla 8c). Stub Fase 5.
export const cierreResumenSchema = z.object({
  fecha: z.string(),
  total: z.number(),
});
export type CierreResumen = z.infer<typeof cierreResumenSchema>;

// Cliente dentro del detalle de ruta: el `ClienteListItem` base (ya con
// saldo/estado/porcentaje reales) + `cobroHoy` — el pago más reciente de HOY
// entre sus créditos activos, o `null` si aún no se le cobró. Es lo que
// separa "Pendientes" de "Cobrados hoy" en #15c (cobrador) y colorea las
// tarjetas de #8c (admin).
export const rutaClienteSchema = clienteListItemSchema.extend({
  cobroHoy: z
    .object({ creditoId: z.string(), monto: z.number(), fecha: z.string() })
    .nullable(),
});
export type RutaCliente = z.infer<typeof rutaClienteSchema>;

// Detalle de ruta (pantalla 8c / #15c cobrador): cabecera + KPIs + Client
// cards + histórico de cierres. `cobradoHoy`/`saldoTotal` son reales (Fase 3);
// `enMora`/`cierres` siguen en stub — la detección de MORA a nivel de Crédito
// y el cierre diario son Fase 5.
export const rutaDetailSchema = rutaSchema.extend({
  cobrador: z.object({ id: z.string(), nombre: z.string() }).nullable(),
  cobradorTelefono: z.string().nullable(),
  estadoDia: estadoDiaRutaSchema,
  avanceDelDia: z.number(),
  clientesCount: z.number().int(),
  cobradoHoy: z.number(),
  enMora: z.number().int(),
  saldoTotal: z.number(),
  cierres: z.array(cierreResumenSchema),
  clientes: z.array(rutaClienteSchema),
});
export type RutaDetail = z.infer<typeof rutaDetailSchema>;

// Body del alta/edición de ruta (pantalla 7b).
export const createRutaRequestSchema = z.object({
  nombre: z.string().min(1, "El nombre de la ruta es obligatorio."),
  cobradorId: z.string().nullable().optional(),
  activa: z.boolean().default(true),
});
export type CreateRutaRequest = z.infer<typeof createRutaRequestSchema>;

export const updateRutaRequestSchema = createRutaRequestSchema.partial();
export type UpdateRutaRequest = z.infer<typeof updateRutaRequestSchema>;

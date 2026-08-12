import { z } from "zod";

import { clienteListItemSchema } from "./client";
import { closureStatusSchema } from "./daily-closure";

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

// Resumen de un cierre diario en el histórico (pantalla 8c), enlazado al
// detalle (#13c) por `id`. Antes stub `{ fecha, total }`; el backend lo puebla
// en Fase 5 (5.9), sin cambiar el tipo desde acá.
export const cierreResumenSchema = z.object({
  id: z.string(),
  fecha: z.string(),
  total: z.number(),
  estado: closureStatusSchema,
  creditosNuevos: z.number().int(),
  clientesSinPagar: z.number().int(),
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
  // SUMA de todo lo abonado hoy por el cliente, en todos sus créditos.
  // `cobroHoy` es solo el ÚLTIMO pago (sirve para el split Pendientes/Cobrados);
  // si el cliente abona dos veces o paga en dos créditos, `cobroHoy.monto` se
  // queda corto y no hay forma de derivar el total en el front. Optional
  // mientras el backend viejo no lo mande.
  totalCobradoHoy: z.number().optional(),
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

// Body para asignar clientes a una ruta en bloque desde la pantalla de Ruta
// (§3 — cierre de Fase 3). Quitar un cliente es 1:1 (`DELETE
// /routes/:id/clients/:clienteId`), no necesita schema propio.
export const assignClientsRequestSchema = z.object({
  clienteIds: z.array(z.string()).min(1, "Selecciona al menos un cliente."),
});
export type AssignClientsRequest = z.infer<typeof assignClientsRequestSchema>;

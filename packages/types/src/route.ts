import { z } from "zod";

import { clienteListItemSchema } from "./client";

// Ruta expuesta al frontend. La asignación cobrador↔ruta vive aquí
// (`cobradorId`), no en una tabla puente: un cobrador tiene 0..N rutas.
export const rutaSchema = z.object({
  id: z.string(),
  nombre: z.string(),
  activa: z.boolean(),
  cobradorId: z.string().nullable(),
});
export type Ruta = z.infer<typeof rutaSchema>;

// Fila de la tabla (pantalla 6c). `totalCobradoHoy` es un STUB (0) hasta que
// existan cobros/cierres (Fase 3/5); la barra de avance de la tabla también.
export const rutaListItemSchema = rutaSchema.extend({
  cobrador: z.object({ id: z.string(), nombre: z.string() }).nullable(),
  clientesCount: z.number().int(),
  totalCobradoHoy: z.number(),
});
export type RutaListItem = z.infer<typeof rutaListItemSchema>;

// Detalle de ruta (pantalla 8c): cabecera + Client cards de la ruta. El
// histórico de cierres NO entra al contrato todavía (stub de la Fase 5).
export const rutaDetailSchema = rutaSchema.extend({
  cobrador: z.object({ id: z.string(), nombre: z.string() }).nullable(),
  clientes: z.array(clienteListItemSchema),
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

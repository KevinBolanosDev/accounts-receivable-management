import { z } from "zod";

import { usuarioSchema, rolSchema } from "./auth";

export const cobradorListItemSchema = usuarioSchema.extend({
  telefono: z.string().nullable(),
  activo: z.boolean(),
  rutas: z.array(z.object({ id: z.string(), nombre: z.string() })),
  clientesCount: z.number().int(),
  cobradoHoy: z.number(),
  // Cuántos `Pago` tiene este cobrador en toda su historia (no solo hoy). Es
  // lo que decide si el botón "Eliminar permanentemente" está habilitado:
  // `Pago.cobradorId` es `onDelete: Restrict`, así que un cobrador con algún
  // pago registrado NO se puede borrar de verdad sin perder el rastro de
  // quién cobró qué — solo desactivar. `.default(0)` porque es un campo de
  // respuesta nuevo (lector tolerante, ver CLAUDE.md raíz).
  pagosCount: z.number().int().nonnegative().default(0),
});
export type CobradorListItem = z.infer<typeof cobradorListItemSchema>;

export const createCobradorRequestSchema = z.object({
  nombre: z.string().min(1, "El nombre es obligatorio."),
  telefono: z.string().min(1, "El teléfono es obligatorio."),
  documento: z.string().min(1, "El documento es obligatorio."),
  password: z.string().min(6, "Mínimo 6 caracteres."),
  rutaId: z.string().nullable().optional(),
});
export type CreateCobradorRequest = z.infer<typeof createCobradorRequestSchema>;

export const updateCobradorRequestSchema = z.object({
  nombre: z.string().optional(),
  telefono: z.string().nullable().optional(),
  activo: z.boolean().optional(),
  rutaId: z.string().nullable().optional(),
});
export type UpdateCobradorRequest = z.infer<typeof updateCobradorRequestSchema>;

export const usuariosQuerySchema = z.object({ rol: rolSchema.optional() });
export type UsuariosQuery = z.infer<typeof usuariosQuerySchema>;

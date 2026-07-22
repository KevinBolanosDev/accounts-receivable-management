import { z } from "zod";

import { usuarioSchema, rolSchema } from "./auth";

// Fila de la tabla de Cobradores (pantalla 11a). Reutiliza `usuarioSchema` de
// auth (mismo modelo `Usuario` de la Fase 1). La asignación cobrador↔ruta vive
// en `Ruta.cobradorId`, así que `rutas` es una lectura derivada (0..N).
export const cobradorListItemSchema = usuarioSchema.extend({
  activo: z.boolean(),
  rutas: z.array(z.object({ id: z.string(), nombre: z.string() })),
});
export type CobradorListItem = z.infer<typeof cobradorListItemSchema>;

// Body del alta de cobrador. El `rol` lo fuerza el servidor a "COBRADOR"; si
// viene `rutaId`, el service escribe `Ruta.cobradorId`.
export const createCobradorRequestSchema = z.object({
  nombre: z.string().min(1, "El nombre es obligatorio."),
  documento: z.string().min(1, "El documento es obligatorio."),
  password: z.string().min(6, "Mínimo 6 caracteres."),
  rutaId: z.string().nullable().optional(),
});
export type CreateCobradorRequest = z.infer<typeof createCobradorRequestSchema>;

export const updateCobradorRequestSchema = z.object({
  nombre: z.string().optional(),
  activo: z.boolean().optional(),
  rutaId: z.string().nullable().optional(),
});
export type UpdateCobradorRequest = z.infer<typeof updateCobradorRequestSchema>;

export const usuariosQuerySchema = z.object({ rol: rolSchema.optional() });
export type UsuariosQuery = z.infer<typeof usuariosQuerySchema>;

import { z } from "zod";

import { usuarioSchema, rolSchema } from "./auth";

// Fila de la tabla de Cobradores (pantalla 11a). Reutiliza `usuarioSchema` de
// auth (mismo modelo `Usuario` de la Fase 1). `clientesCount`/`cobradoHoy` son
// datos de cobros (Fase 3): stub del mock. La asignación cobrador↔ruta vive en
// `Ruta.cobradorId`, así que `rutas` es una lectura derivada (0..N).
export const cobradorListItemSchema = usuarioSchema.extend({
  telefono: z.string(),
  activo: z.boolean(),
  rutas: z.array(z.object({ id: z.string(), nombre: z.string() })),
  clientesCount: z.number().int(),
  cobradoHoy: z.number(),
});
export type CobradorListItem = z.infer<typeof cobradorListItemSchema>;

// Body del alta de cobrador (modal de 11a): nombre + teléfono + ruta + activo.
// El documento/contraseña de login los resuelve el backend (decisión abierta,
// ver FASE_2_SUBFASES.md); el formulario del prototipo no los pide.
export const createCobradorRequestSchema = z.object({
  nombre: z.string().min(1, "El nombre es obligatorio."),
  telefono: z.string().min(1, "El teléfono es obligatorio."),
  rutaId: z.string().nullable().optional(),
  // Sin `.default()`: con zodResolver el default hace divergir el tipo de
  // entrada/salida de react-hook-form. El valor inicial lo pone el formulario.
  activo: z.boolean(),
});
export type CreateCobradorRequest = z.infer<typeof createCobradorRequestSchema>;

export const updateCobradorRequestSchema = z.object({
  nombre: z.string().optional(),
  telefono: z.string().optional(),
  activo: z.boolean().optional(),
  rutaId: z.string().nullable().optional(),
});
export type UpdateCobradorRequest = z.infer<typeof updateCobradorRequestSchema>;

export const usuariosQuerySchema = z.object({ rol: rolSchema.optional() });
export type UsuariosQuery = z.infer<typeof usuariosQuerySchema>;

import { z } from "zod";

// Rol del principal autenticado por JWT.
// - ADMIN/COBRADOR: usuarios del staff (modelo `Usuario`).
// - CLIENTE: cliente final autenticado por credenciales (modelo `Cliente`).
// El cliente NO es un `Usuario` (vive en su propia tabla), pero comparte el
// mismo esquema JWT y los mismos Guards; el `RolesGuard` lee este rol y el
// `MustChangePasswordGuard` aplica solo a `CLIENTE`.
export const rolSchema = z.enum(["ADMIN", "COBRADOR", "CLIENTE"]);
export type Rol = z.infer<typeof rolSchema>;

// Credenciales que envía el formulario de login.
export const loginRequestSchema = z.object({
  documento: z.string().min(1, "Ingresa tu documento de identidad."),
  password: z.string().min(1, "Ingresa tu contraseña."),
});
export type LoginRequest = z.infer<typeof loginRequestSchema>;

// Usuario expuesto al cliente. Nunca incluye passwordHash.
export const usuarioSchema = z.object({
  id: z.string(),
  nombre: z.string(),
  documento: z.string(),
  rol: rolSchema,
});
export type Usuario = z.infer<typeof usuarioSchema>;

// Respuesta del login: token emitido + perfil del usuario autenticado.
export const loginResponseSchema = z.object({
  token: z.string(),
  usuario: usuarioSchema,
});
export type LoginResponse = z.infer<typeof loginResponseSchema>;

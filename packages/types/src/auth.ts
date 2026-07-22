import { z } from "zod";

// Rol del usuario del sistema (el cliente final no es un Usuario, no tiene login).
export const rolSchema = z.enum(["ADMIN", "COBRADOR"]);
export type Rol = z.infer<typeof rolSchema>;

// Credenciales que envía el formulario de login.
export const loginRequestSchema = z.object({
  telefono: z.string().min(1, "Ingresa tu teléfono."),
  password: z.string().min(1, "Ingresa tu contraseña."),
});
export type LoginRequest = z.infer<typeof loginRequestSchema>;

// Usuario expuesto al cliente. Nunca incluye passwordHash.
export const usuarioSchema = z.object({
  id: z.string(),
  nombre: z.string(),
  telefono: z.string(),
  rol: rolSchema,
});
export type Usuario = z.infer<typeof usuarioSchema>;

// Respuesta del login: token emitido + perfil del usuario autenticado.
export const loginResponseSchema = z.object({
  token: z.string(),
  usuario: usuarioSchema,
});
export type LoginResponse = z.infer<typeof loginResponseSchema>;

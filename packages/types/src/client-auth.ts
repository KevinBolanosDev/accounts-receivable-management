import { z } from "zod";

// Fase 4 — credenciales del cliente final (NO es un Usuario). El cliente
// vive en la tabla `Cliente` y entra con documento + contraseña. La
// contraseña la genera el staff (admin/cobrador) en `POST /clients/:id/access`;
// el primer ingreso fuerza el cambio (`mustChangePassword`).
export const clientLoginRequestSchema = z.object({
  documento: z.string().min(6, "Ingresa tu documento de identidad."),
  password: z.string().min(1, "Ingresa tu contraseña."),
});
export type ClientLoginRequest = z.infer<typeof clientLoginRequestSchema>;

// Cambio de contraseña. La regla "nueva ≠ actual" se valida con `.refine`
// para mostrar el error en el campo `newPassword` directamente.
export const changePasswordRequestSchema = z
  .object({
    currentPassword: z.string().min(1, "Ingresa tu contraseña actual."),
    newPassword: z.string().min(8, "Mínimo 8 caracteres."),
  })
  .refine((d) => d.newPassword !== d.currentPassword, {
    message: "La nueva contraseña no puede ser igual a la actual.",
    path: ["newPassword"],
  });
export type ChangePasswordRequest = z.infer<typeof changePasswordRequestSchema>;

// Shape público del cliente autenticado. Nunca incluye `passwordHash`,
// `failedLoginAttempts`, `lockedUntil` ni `passwordExpiresAt` (datos
// sensibles — el service los filtra en `toClientAuthUser`). `rutaId` se
// expone porque la UI del portal lo usa para mostrar el contexto.
export const clientAuthUserSchema = z.object({
  id: z.string(),
  nombre: z.string(),
  documento: z.string(),
  telefono: z.string(),
  direccion: z.string(),
  mustChangePassword: z.boolean(),
  rutaId: z.string().nullable(),
});
export type ClientAuthUser = z.infer<typeof clientAuthUserSchema>;

// Respuesta del login del cliente: token + shape público.
export const clientLoginResponseSchema = z.object({
  token: z.string(),
  cliente: clientAuthUserSchema,
});
export type ClientLoginResponse = z.infer<typeof clientLoginResponseSchema>;

// Alias semántico del mismo shape — el endpoint `GET /client-auth/me` devuelve
// solo el cliente autenticado, sin token.
export const clientMeResponseSchema = clientAuthUserSchema;
export type ClientMeResponse = z.infer<typeof clientMeResponseSchema>;
import type { Rol } from "@repo/types";

// Lo mínimo que viaja en el JWT (ver AuthService.login): nunca datos sensibles.
export interface AuthenticatedUser {
  sub: string;
  rol: Rol;
  // Tenant del usuario = id del ADMIN dueño de los datos.
  //   ADMIN    → su propio `sub` (es la raíz del tenant)
  //   COBRADOR → el id del ADMIN al que pertenece
  //   CLIENTE  → ausente; el portal se scopea por `sub` (su propio clienteId),
  //              no por tenant.
  // Opcional en el tipo porque los tokens viejos (pre multi-tenancy) no lo
  // traen. Nunca leerlo directo para construir un `where`: usar
  // `requireAdminId` (tenant.util.ts), que falla cerrado si falta.
  adminId?: string;
}

declare module "express" {
  interface Request {
    user?: AuthenticatedUser;
  }
}

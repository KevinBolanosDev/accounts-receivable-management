import type { Rol } from "@repo/types";

// Lo mínimo que viaja en el JWT (ver AuthService.login): nunca datos sensibles.
export interface AuthenticatedUser {
  sub: string;
  rol: Rol;
}

declare module "express" {
  interface Request {
    user?: AuthenticatedUser;
  }
}

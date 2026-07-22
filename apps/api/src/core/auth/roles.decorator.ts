import { SetMetadata } from "@nestjs/common";
import type { Rol } from "@repo/types";

export const ROLES_KEY = "roles";

// @Roles("ADMIN") — deja el/los rol(es) permitidos como metadata del handler,
// que RolesGuard lee después con el Reflector.
export const Roles = (...roles: Rol[]) => SetMetadata(ROLES_KEY, roles);

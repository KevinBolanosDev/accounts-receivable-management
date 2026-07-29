import { ForbiddenException } from "@nestjs/common";
import type { Rol } from "@repo/types";

import type { AuthenticatedUser } from "./auth-request";

/**
 * Resuelve el tenant (id del ADMIN dueño) de una fila `Usuario` recién leída.
 *
 * El ADMIN es la raíz del tenant: su dueño es él mismo, y por eso su columna
 * `adminId` es null en la base. El COBRADOR cuelga de un ADMIN.
 *
 * Devuelve null solo si un COBRADOR quedó sin admin asignado — dato corrupto
 * que el llamador debe tratar como error, nunca como "sin restricción".
 */
export function resolveAdminId(usuario: {
  id: string;
  rol: Rol;
  adminId: string | null;
}): string | null {
  return usuario.rol === "ADMIN" ? usuario.id : usuario.adminId;
}

/**
 * Tenant del usuario autenticado, o 403 si el token no lo trae.
 *
 * Falla CERRADO a propósito. Los JWT emitidos antes de la migración
 * multi-tenant no tienen el claim `adminId`; si un llamador interpretara la
 * ausencia como "sin filtro", cada token viejo seguiría viendo la cartera de
 * todos los admins — exactamente el bug que esta capa existe para cerrar.
 */
export function requireAdminId(user: AuthenticatedUser): string {
  if (!user.adminId) {
    throw new ForbiddenException(
      "Tu sesión no es válida para esta versión. Vuelve a iniciar sesión.",
    );
  }
  return user.adminId;
}

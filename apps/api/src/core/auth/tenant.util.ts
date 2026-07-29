import { UnauthorizedException } from "@nestjs/common";
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
 * Tenant del usuario autenticado, o 401 si el token no lo trae.
 *
 * Falla CERRADO a propósito. Los JWT emitidos antes de la migración
 * multi-tenant no tienen el claim `adminId`; si un llamador interpretara la
 * ausencia como "sin filtro", cada token viejo seguiría viendo la cartera de
 * todos los admins — exactamente el bug que esta capa existe para cerrar.
 *
 * Es 401 (no 403) porque el problema es el token, no los permisos: el mismo
 * usuario reintentando con credenciales frescas SÍ pasa. El 403 dejaba al
 * front atrapado — no tenía forma de distinguir "no tienes permiso" (mostrar
 * el error) de "tu token quedó viejo" (cerrar sesión y volver a pedir login),
 * así que reintentaba para siempre contra la misma pared. El `code`
 * machine-readable existe para que el cliente no tenga que parsear el mensaje.
 */
export const SESSION_STALE_CODE = "SESSION_STALE";

export function requireAdminId(user: AuthenticatedUser): string {
  if (!user.adminId) {
    throw new UnauthorizedException({
      statusCode: 401,
      code: SESSION_STALE_CODE,
      message: "Tu sesión no es válida para esta versión. Vuelve a iniciar sesión.",
    });
  }
  return user.adminId;
}

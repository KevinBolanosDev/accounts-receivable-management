import { ForbiddenException, NotFoundException } from "@nestjs/common";

import type { AuthenticatedUser } from "../auth/auth-request";
import { requireAdminId } from "../auth/tenant.util";

// Scoping por ruta, compartido entre `clientes`, `cobros` y `daily-closures`
// (antes vivía duplicado en `clientes.service.ts` y como un chequeo inline en
// `cobros.service.ts`). Cero I/O: recibe la ruta YA CARGADA (o `null`) y
// decide, nunca hace su propio `findUnique` — cada módulo sigue dueño de
// cómo resuelve esa lectura.

export interface RouteForAccessCheck {
  adminId: string;
  cobradorId: string | null;
}

/**
 * ¿El usuario puede tocar esta ruta? 404 si no existe en su tenant (nunca
 * 403: confirmar que el id existe en la cartera de otro admin sería una
 * fuga), 403 si es COBRADOR y la ruta no es suya. Para cuando `routeId`
 * viene de un request y todavía no se validó que exista — el caso de
 * `clients.service.ts` (alta/edición con `rutaId`) y `daily-closures`
 * (preview/cerrar/lista/detalle/pdf, todos reciben `routeId` directo).
 *
 * Genérico (no solo `RouteForAccessCheck`) y con `asserts`: el caller suele
 * necesitar más campos de la ruta después del chequeo (ej. `nombre`), y con
 * un type guard TypeScript los conserva sin un `!` en cada uso.
 */
export function assertRouteAccess<T extends RouteForAccessCheck>(
  route: T | null,
  user: AuthenticatedUser,
  messages?: { notFound?: string; forbidden?: string },
): asserts route is T {
  if (!route || route.adminId !== requireAdminId(user)) {
    throw new NotFoundException(messages?.notFound ?? "La ruta no existe.");
  }
  assertRouteOwnership(route, user, messages?.forbidden);
}

/**
 * Solo la mitad "¿es mía?" del chequeo (403, sin 404) — para cuando la ruta
 * ya llegó por otro camino cuya lectura YA garantizó el tenant (ej. a través
 * del crédito de un cliente en `cobros.service.ts`, donde un crédito de otro
 * admin ya respondió 404 antes de llegar acá). Repetir el chequeo de tenant
 * sería una segunda consulta redundante, no una capa de seguridad extra.
 */
export function assertRouteOwnership(
  route: { cobradorId: string | null } | null | undefined,
  user: AuthenticatedUser,
  forbiddenMessage?: string,
): void {
  if (user.rol === "COBRADOR" && route?.cobradorId !== user.sub) {
    throw new ForbiddenException(forbiddenMessage ?? "No tienes acceso a esta ruta.");
  }
}

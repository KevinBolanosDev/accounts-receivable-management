// Fase 4 — política de lockout, compartida por los DOS logins del sistema:
// `AuthClienteService.login` (Cliente, desde Fase 4) y `AuthService.login`
// (Usuario/staff, agregado en el hardening de Fase 6 — antes el login de
// ADMIN/COBRADOR solo tenía el throttle por IP de abajo, el único login del
// sistema sin defensa por cuenta).
//
// Hay DOS sistemas de rate-limit que se complementan (no se reemplazan):
//
// 1. **Throttler por IP** (`@nestjs/throttler`, ver `app.module.ts`): protege
//    contra botnets que prueban muchas contraseñas desde la misma IP.
// 2. **Lockout por documento** (estas constantes + cada service): protege
//    contra enumeración del `documento` (público, enumerable). Si atacas N
//    documentos distintos desde N IPs distintas, el throttler de IP no te
//    frena — pero cada documento se bloquea tras MAX_FAILED_ATTEMPTS intentos.
//
// Si solo tuvieras uno, dejarías superficie abierta. Mantener ambos es
// mandatorio (ver §Fase 4.3 de `FASE_4_SUBFASES.md`).

// Intentos fallidos antes de bloquear la cuenta.
export const MAX_FAILED_ATTEMPTS = 5;

// Duración del bloqueo tras alcanzar MAX_FAILED_ATTEMPTS.
export const LOCKOUT_DURATION_MINUTES = 15;

// Validez de la contraseña temporal que el staff genera al crear/resetear el
// acceso. Pasado este tiempo, el cliente debe pedirle al staff una nueva.
export const TEMPORARY_PASSWORD_EXPIRY_HOURS = 24;

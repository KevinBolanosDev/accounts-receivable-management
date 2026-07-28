import { HttpException, HttpStatus, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcrypt";

import type { AuthenticatedUser } from "../../core/auth/auth-request";
import type {
  ChangePasswordRequest,
  ClientAuthUser,
  ClientLoginRequest,
  ClientLoginResponse,
  ClientMeResponse,
} from "@repo/types";

import { LOCKOUT_DURATION_MINUTES, MAX_FAILED_ATTEMPTS } from "../../core/security/lockout-policy";
import { AuthClienteRepository } from "./auth-cliente.repository";

@Injectable()
export class AuthClienteService {
  constructor(
    private readonly repository: AuthClienteRepository,
    private readonly jwt: JwtService,
  ) {}

  // Login del cliente. Maneja 4 veredictos:
  // 1. Documento inexistente → error genérico (no revelar existencia).
  // 2. `passwordHash` null → mismo error genérico (cliente sin acceso).
  // 3. Cuenta bloqueada por demasiados intentos → 429 con minutos restantes.
  // 4. Password temporal expirada → mensaje específico (no incrementa attempts).
  // Si pasa, emite JWT con `rol: "CLIENTE"` y limpia contadores.
  async login(body: ClientLoginRequest): Promise<ClientLoginResponse> {
    const cliente = await this.repository.findByDocumento(body.documento);

    if (!cliente || cliente.passwordHash === null) {
      // Mismo mensaje para inexistente vs sin acceso: NO se revela si el
      // documento existe. Esto protege contra enumeración (el `documento`
      // es público y enumerable — el único secreto es la contraseña).
      throw new UnauthorizedException("Documento o contraseña incorrectos.");
    }

    if (cliente.lockedUntil && cliente.lockedUntil > new Date()) {
      const minutes = Math.ceil((cliente.lockedUntil.getTime() - Date.now()) / 60_000);
      throw new HttpException(
        {
          message: `Demasiados intentos. Intenta en ${minutes} minutos.`,
          code: "ACCOUNT_LOCKED",
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    if (cliente.passwordExpiresAt && cliente.passwordExpiresAt < new Date()) {
      // La temporal venció. NO incrementamos `failedLoginAttempts` (no es un
      // intento fallido de autenticación, es una cuenta que necesita reset).
      throw new UnauthorizedException(
        "Tu contraseña temporal expiró. Solicita una nueva al staff.",
      );
    }

    const passwordOk = await bcrypt.compare(body.password, cliente.passwordHash);

    if (!passwordOk) {
      // Incremento ATÓMICO (`{ increment: 1 }`, un solo UPDATE en Postgres) —
      // no un read-modify-write en JS. Dos requests concurrentes con la misma
      // password mala (Fase 4.17, hallazgo de hardening) antes leían el mismo
      // `failedLoginAttempts` base y podían "perder" un incremento al
      // escribir el mismo valor absoluto dos veces; el incremento atómico lo
      // serializa a nivel de fila en la base y cada request ve el conteo
      // real post-incremento, así que la decisión de bloquear (`shouldLock`)
      // nunca queda corta. Probado en `auth-cliente.e2e-spec.ts` con
      // `Promise.all` de intentos simultáneos.
      const updated = await this.repository.update(cliente.id, {
        failedLoginAttempts: { increment: 1 },
      });
      if (updated.failedLoginAttempts >= MAX_FAILED_ATTEMPTS) {
        await this.repository.update(cliente.id, {
          lockedUntil: new Date(Date.now() + LOCKOUT_DURATION_MINUTES * 60_000),
        });
      }
      throw new UnauthorizedException("Documento o contraseña incorrectos.");
    }

    // Éxito: limpiar contadores y emitir token.
    await this.repository.update(cliente.id, {
      failedLoginAttempts: 0,
      lockedUntil: null,
      lastLoginAt: new Date(),
    });

    const token = await this.jwt.signAsync({
      sub: cliente.id,
      rol: "CLIENTE",
    });

    return {
      token,
      cliente: toClientAuthUser(cliente),
    };
  }

  async changePassword(
    body: ChangePasswordRequest,
    user: AuthenticatedUser,
  ): Promise<ClientMeResponse> {
    const cliente = await this.repository.findById(user.sub);
    if (!cliente || cliente.passwordHash === null) {
      throw new UnauthorizedException("Cliente no encontrado o sin acceso.");
    }

    const currentOk = await bcrypt.compare(body.currentPassword, cliente.passwordHash);
    if (!currentOk) {
      throw new UnauthorizedException("La contraseña actual es incorrecta.");
    }

    const newHash = await bcrypt.hash(body.newPassword, 10);
    const updated = await this.repository.update(cliente.id, {
      passwordHash: newHash,
      mustChangePassword: false,
      passwordExpiresAt: null,
      failedLoginAttempts: 0,
      lockedUntil: null,
    });

    return toClientAuthUser(updated);
  }

  async me(user: AuthenticatedUser): Promise<ClientMeResponse> {
    const cliente = await this.repository.findById(user.sub);
    if (!cliente) {
      throw new UnauthorizedException("Cliente no encontrado.");
    }
    return toClientAuthUser(cliente);
  }
}

// Filtra campos sensibles. Es el ÚNICO lugar que decide qué se devuelve al
// cliente autenticado — nunca incluir `passwordHash`, contadores de seguridad
// ni fechas internas de expiración.
function toClientAuthUser(c: {
  id: string;
  nombre: string;
  documento: string;
  telefono: string;
  direccion: string;
  mustChangePassword: boolean;
  rutaId: string | null;
}): ClientAuthUser {
  return {
    id: c.id,
    nombre: c.nombre,
    documento: c.documento,
    telefono: c.telefono,
    direccion: c.direccion,
    mustChangePassword: c.mustChangePassword,
    rutaId: c.rutaId,
  };
}

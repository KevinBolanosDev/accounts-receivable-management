import { HttpException, HttpStatus, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcrypt";
import type { LoginRequest, LoginResponse, Usuario } from "@repo/types";

import { PrismaService } from "../../core/prisma/prisma.service";
import type { AuthenticatedUser } from "../../core/auth/auth-request";
import { resolveAdminId } from "../../core/auth/tenant.util";
import { LOCKOUT_DURATION_MINUTES, MAX_FAILED_ATTEMPTS } from "../../core/security/lockout-policy";

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  // Login del staff (ADMIN/COBRADOR). Mismo mecanismo de lockout por cuenta
  // que `AuthClienteService.login` (ver `core/security/lockout-policy.ts`):
  // el throttle por IP de `auth.controller.ts` no alcanza solo, un atacante
  // distribuido por IP podía probar contraseñas sin límite contra un mismo
  // ADMIN — el rol de mayor privilegio del sistema era el único login sin
  // defensa por cuenta.
  async login({ documento, password }: LoginRequest): Promise<LoginResponse> {
    const usuario = await this.prisma.usuario.findUnique({ where: { documento } });

    // `activo` se comprueba acá y no en el guard: sin esto, el switch
    // activo/inactivo de la pantalla de cobradores era decorativo — un
    // cobrador desactivado (o eliminado, que es una baja lógica) seguía
    // pudiendo entrar y registrar cobros.
    //
    // Mismo mensaje que las credenciales malas, a propósito: decir "tu cuenta
    // está inactiva" confirmaría que ese documento existe en el sistema.
    if (!usuario || !usuario.activo) {
      throw new UnauthorizedException("Documento o contraseña incorrectos.");
    }

    if (usuario.lockedUntil && usuario.lockedUntil > new Date()) {
      const minutes = Math.ceil((usuario.lockedUntil.getTime() - Date.now()) / 60_000);
      throw new HttpException(
        {
          message: `Demasiados intentos. Intenta en ${minutes} minutos.`,
          code: "ACCOUNT_LOCKED",
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const passwordOk = await bcrypt.compare(password, usuario.passwordHash);

    if (!passwordOk) {
      // Incremento ATÓMICO, no read-modify-write — mismo motivo que
      // `AuthClienteService.login`: dos requests concurrentes con la misma
      // password mala no deben poder "perder" un incremento.
      const updated = await this.prisma.usuario.update({
        where: { id: usuario.id },
        data: { failedLoginAttempts: { increment: 1 } },
      });
      if (updated.failedLoginAttempts >= MAX_FAILED_ATTEMPTS) {
        await this.prisma.usuario.update({
          where: { id: usuario.id },
          data: { lockedUntil: new Date(Date.now() + LOCKOUT_DURATION_MINUTES * 60_000) },
        });
      }
      throw new UnauthorizedException("Documento o contraseña incorrectos.");
    }

    // Éxito: limpiar contadores.
    if (usuario.failedLoginAttempts > 0 || usuario.lockedUntil) {
      await this.prisma.usuario.update({
        where: { id: usuario.id },
        data: { failedLoginAttempts: 0, lockedUntil: null },
      });
    }

    // Tenant en el token: el scoping de TODOS los servicios de staff sale de
    // acá. Un COBRADOR sin admin asignado es dato corrupto — no se le emite
    // token en vez de dejarlo entrar sin tenant (fallaría abierto).
    const adminId = resolveAdminId(usuario);
    if (!adminId) {
      throw new UnauthorizedException(
        "Tu usuario no tiene un administrador asignado. Contacta al soporte.",
      );
    }

    const payload: AuthenticatedUser = { sub: usuario.id, rol: usuario.rol, adminId };
    const token = await this.jwt.signAsync(payload);

    return {
      token,
      usuario: {
        id: usuario.id,
        nombre: usuario.nombre,
        documento: usuario.documento,
        rol: usuario.rol,
      },
    };
  }

  async getProfile(id: string): Promise<Usuario> {
    const usuario = await this.prisma.usuario.findUnique({ where: { id } });

    if (!usuario) {
      throw new UnauthorizedException("El usuario ya no existe.");
    }

    return {
      id: usuario.id,
      nombre: usuario.nombre,
      documento: usuario.documento,
      rol: usuario.rol,
    };
  }
}

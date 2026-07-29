import { Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcrypt";
import type { LoginRequest, LoginResponse, Usuario } from "@repo/types";

import { PrismaService } from "../../core/prisma/prisma.service";
import type { AuthenticatedUser } from "../../core/auth/auth-request";
import { resolveAdminId } from "../../core/auth/tenant.util";

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async login({ documento, password }: LoginRequest): Promise<LoginResponse> {
    const usuario = await this.prisma.usuario.findUnique({ where: { documento } });

    if (!usuario || !(await bcrypt.compare(password, usuario.passwordHash))) {
      throw new UnauthorizedException("Documento o contraseña incorrectos.");
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

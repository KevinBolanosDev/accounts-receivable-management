import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from "@nestjs/common";
import type { Request } from "express";

import { PrismaService } from "../prisma/prisma.service";

// Fase 4 — bloquea toda operación del cliente autenticado (`rol: "CLIENTE"`)
// mientras `mustChangePassword=true`, salvo la excepción explícita
// (`POST /client-auth/change-password`, que NO monta este guard — es la
// salida del lockout). No aplica a staff: `request.user` siempre existe acá
// porque este guard corre DESPUÉS de `JwtAuthGuard` (nunca solo).
@Injectable()
export class MustChangePasswordGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const user = request.user;

    if (!user || user.rol !== "CLIENTE") return true;

    const cliente = await this.prisma.cliente.findUnique({
      where: { id: user.sub },
      select: { mustChangePassword: true },
    });

    if (cliente?.mustChangePassword) {
      throw new HttpException(
        {
          message: "Debes cambiar tu contraseña temporal antes de continuar.",
          code: "MUST_CHANGE_PASSWORD",
        },
        HttpStatus.PRECONDITION_REQUIRED,
      );
    }

    return true;
  }
}

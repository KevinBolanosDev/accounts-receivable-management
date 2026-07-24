import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";

import type { AuthenticatedUser } from "./auth-request";
import { IS_PUBLIC_KEY } from "./public.decorator";

// Verifica el Bearer del header, decodifica el JWT y adjunta el usuario
// (payload mínimo: sub + rol) al request para que @CurrentUser() y
// RolesGuard lo lean después. Si el handler lleva `@Public()`, deja pasar
// sin token — útil en controllers mixtos.
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractToken(request);

    if (!token) {
      throw new UnauthorizedException("Falta el token de sesión.");
    }

    try {
      request.user = await this.jwt.verifyAsync<AuthenticatedUser>(token);
    } catch {
      throw new UnauthorizedException("Token inválido o expirado.");
    }

    return true;
  }

  private extractToken(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(" ") ?? [];
    return type === "Bearer" ? token : undefined;
  }
}

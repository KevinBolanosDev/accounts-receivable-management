import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import type { Request } from "express";

import type { AuthenticatedUser } from "./auth-request";

// Verifica el Bearer del header, decodifica el JWT y adjunta el usuario
// (payload mínimo: sub + rol) al request para que @CurrentUser() y
// RolesGuard lo lean después.
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
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

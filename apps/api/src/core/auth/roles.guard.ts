import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import type { Rol } from "@repo/types";

import { ROLES_KEY } from "./roles.decorator";

// Corre DESPUÉS de JwtAuthGuard (que ya dejó request.user). Lee la metadata
// que puso @Roles(...) y la compara con el rol del usuario autenticado.
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Rol[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();

    if (!request.user || !requiredRoles.includes(request.user.rol)) {
      throw new ForbiddenException("No tienes permiso para acceder a este recurso.");
    }

    return true;
  }
}

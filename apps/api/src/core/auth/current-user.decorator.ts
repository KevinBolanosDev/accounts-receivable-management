import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { Request } from "express";

import type { AuthenticatedUser } from "./auth-request";

// Inyecta el usuario que dejó JwtAuthGuard en el request (solo tiene sentido
// detrás de ese guard).
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedUser | undefined => {
    return context.switchToHttp().getRequest<Request>().user;
  },
);

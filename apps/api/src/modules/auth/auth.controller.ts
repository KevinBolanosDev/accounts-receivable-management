import { Body, Controller, Get, HttpCode, HttpStatus, Post } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import {
  loginRequestSchema,
  usuarioSchema,
  type LoginRequest,
  type LoginResponse,
  type Usuario,
} from "@repo/types";

import { ZodValidationPipe } from "../../core/pipes/zod-validation.pipe";
import { CurrentUser } from "../../core/auth/current-user.decorator";
import { Roles } from "../../core/auth/roles.decorator";
import { Public } from "../../core/auth/public.decorator";
import type { AuthenticatedUser } from "../../core/auth/auth-request";
import { AuthService } from "./auth.service";

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // Throttle propio, como el login del cliente: antes lo cubría de rebote el
  // default global (10/min), pero ese techo se subió a 200/min porque asfixiaba
  // la navegación normal. El login sí necesita el límite bajo — es la superficie
  // de fuerza bruta del staff.
  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post("login")
  @HttpCode(HttpStatus.OK)
  login(
    @Body(new ZodValidationPipe(loginRequestSchema)) body: LoginRequest,
  ): Promise<LoginResponse> {
    return this.authService.login(body);
  }

  @Get("me")
  async me(@CurrentUser() user: AuthenticatedUser): Promise<Usuario> {
    const usuario = await this.authService.getProfile(user.sub);
    return usuarioSchema.parse(usuario);
  }

  // Endpoint de ejemplo (sin uso de negocio) solo para demostrar el gateo por rol.
  @Get("admin-only")
  @Roles("ADMIN")
  adminOnly(): { message: string } {
    return { message: "Solo un Admin puede ver esto." };
  }
}

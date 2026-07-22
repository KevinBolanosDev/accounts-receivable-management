import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from "@nestjs/common";
import {
  loginRequestSchema,
  usuarioSchema,
  type LoginRequest,
  type LoginResponse,
  type Usuario,
} from "@repo/types";

import { ZodValidationPipe } from "../../core/pipes/zod-validation.pipe";
import { CurrentUser } from "../../core/auth/current-user.decorator";
import { JwtAuthGuard } from "../../core/auth/jwt-auth.guard";
import { RolesGuard } from "../../core/auth/roles.guard";
import { Roles } from "../../core/auth/roles.decorator";
import type { AuthenticatedUser } from "../../core/auth/auth-request";
import { AuthService } from "./auth.service";

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("login")
  @HttpCode(HttpStatus.OK)
  login(
    @Body(new ZodValidationPipe(loginRequestSchema)) body: LoginRequest,
  ): Promise<LoginResponse> {
    return this.authService.login(body);
  }

  @Get("me")
  @UseGuards(JwtAuthGuard)
  async me(@CurrentUser() user: AuthenticatedUser): Promise<Usuario> {
    const usuario = await this.authService.getProfile(user.sub);
    return usuarioSchema.parse(usuario);
  }

  // Endpoint de ejemplo (sin uso de negocio) solo para demostrar el gateo por rol.
  @Get("admin-only")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN")
  adminOnly(): { message: string } {
    return { message: "Solo un Admin puede ver esto." };
  }
}

import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import {
  changePasswordRequestSchema,
  clientAuthUserSchema,
  clientLoginRequestSchema,
  clientLoginResponseSchema,
  clientMeResponseSchema,
  type ChangePasswordRequest,
  type ClientLoginRequest,
  type ClientLoginResponse,
  type ClientMeResponse,
} from "@repo/types";

import type { AuthenticatedUser } from "../../core/auth/auth-request";
import { CurrentUser } from "../../core/auth/current-user.decorator";
import { MustChangePasswordGuard } from "../../core/auth/must-change-password.guard";
import { Roles } from "../../core/auth/roles.decorator";
import { Public } from "../../core/auth/public.decorator";
import { ZodValidationPipe } from "../../core/pipes/zod-validation.pipe";
import { AuthClienteService } from "./auth-cliente.service";

// Fase 4 — auth del cliente final (3er principal del JWT). Mismo `JwtAuthGuard`
// global que Admin/Cobrador; el `sub` del payload es el `clienteId` y el rol
// es `"CLIENTE"`. El `MustChangePasswordGuard` se aplica en los módulos que
// protegen al cliente autenticado (`client-portal`, `client-auth.me`); NO
// aquí en `change-password` porque esa es la salida del lockout.
@Controller("client-auth")
export class AuthClienteController {
  constructor(private readonly authClienteService: AuthClienteService) {}

  // 5 req/min por IP — más estricto que el global (10) porque el `documento`
  // es enumerable y este endpoint es el único vector de fuerza bruta contra
  // el portal. El lockout por documento (`MAX_FAILED_ATTEMPTS` en service)
  // cubre el caso de muchas IPs contra muchos documentos.
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post("login")
  @HttpCode(HttpStatus.OK)
  async login(
    @Body(new ZodValidationPipe(clientLoginRequestSchema)) body: ClientLoginRequest,
  ): Promise<ClientLoginResponse> {
    const result = await this.authClienteService.login(body);
    return clientLoginResponseSchema.parse(result);
  }

  @Roles("CLIENTE")
  @UseGuards(MustChangePasswordGuard)
  @Get("me")
  async me(@CurrentUser() user: AuthenticatedUser): Promise<ClientMeResponse> {
    const result = await this.authClienteService.me(user);
    return clientMeResponseSchema.parse(result);
  }

  // Sin `Roles("CLIENTE")` no podríamos autenticar antes del cambio, pero
  // NO aplicamos `MustChangePasswordGuard` aquí — esta es la salida del
  // lockout. El cliente con `mustChangePassword=true` entra a esta ruta
  // aunque sus otros endpoints devuelvan 428.
  @Roles("CLIENTE")
  @Post("change-password")
  @HttpCode(HttpStatus.OK)
  async changePassword(
    @Body(new ZodValidationPipe(changePasswordRequestSchema)) body: ChangePasswordRequest,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ClientMeResponse> {
    const result = await this.authClienteService.changePassword(body, user);
    return clientAuthUserSchema.parse(result);
  }
}

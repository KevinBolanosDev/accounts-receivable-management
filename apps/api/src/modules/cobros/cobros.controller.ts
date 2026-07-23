import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import {
  cobroResponseSchema,
  createCobroRequestSchema,
  type CobroResponse,
  type CreateCobroRequest,
} from "@repo/types";

import type { AuthenticatedUser } from "../../core/auth/auth-request";
import { CurrentUser } from "../../core/auth/current-user.decorator";
import { JwtAuthGuard } from "../../core/auth/jwt-auth.guard";
import { ZodValidationPipe } from "../../core/pipes/zod-validation.pipe";

import { CobrosService } from "./cobros.service";

@Controller("collections")
@UseGuards(JwtAuthGuard)
export class CobrosController {
  constructor(private readonly cobrosService: CobrosService) {}

  // DESIGN_SYSTEM §3.9 / §Fase 3 — cobro atómico. Devuelve CobroResponse
  // (pago + crédito recalculado) para el update optimista del front.
  @Post()
  async registrar(
    @Body(new ZodValidationPipe(createCobroRequestSchema)) body: CreateCobroRequest,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<CobroResponse> {
    const result = await this.cobrosService.registrar(body, user);
    // El controller re-parsea con `cobroResponseSchema` para mantener la
    // convención del proyecto y blindar el shape del contrato.
    return cobroResponseSchema.parse(result);
  }
}

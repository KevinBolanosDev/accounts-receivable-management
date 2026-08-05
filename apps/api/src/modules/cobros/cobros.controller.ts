import { Body, Controller, Delete, Param, Post } from "@nestjs/common";
import {
  anularPagoResponseSchema,
  cobroResponseSchema,
  createCobroRequestSchema,
  type AnularPagoResponse,
  type CobroResponse,
  type CreateCobroRequest,
} from "@repo/types";

import type { AuthenticatedUser } from "../../core/auth/auth-request";
import { CurrentUser } from "../../core/auth/current-user.decorator";
import { Roles } from "../../core/auth/roles.decorator";
import { ZodValidationPipe } from "../../core/pipes/zod-validation.pipe";

import { CobrosService } from "./cobros.service";

// Sin `@Roles`, un CLIENTE autenticado podía llamar `POST /collections`
// (hallazgo de auditoría, ver PLAN_DESARROLLO §1.1) — registrar cobros es
// exclusivamente de staff.
@Controller("collections")
@Roles("ADMIN", "COBRADOR")
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

  // Anular un pago mal registrado (ver `CobrosService.anularPago`). ADMIN y
  // COBRADOR — el `@Roles` de la clase ya cubre este handler; el scoping por
  // ruta del COBRADOR lo valida el service, no el controller.
  @Delete(":pagoId")
  async anularPago(
    @Param("pagoId") pagoId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<AnularPagoResponse> {
    return anularPagoResponseSchema.parse(await this.cobrosService.anularPago(pagoId, user));
  }
}

import { Controller, Get, Header, Param } from "@nestjs/common";

import type { AuthenticatedUser } from "../../core/auth/auth-request";
import { CurrentUser } from "../../core/auth/current-user.decorator";
import { Roles } from "../../core/auth/roles.decorator";
import { ReceiptsService } from "./receipts.service";

// Fase 4 — Recibo HTML server-rendered. `JwtAuthGuard`/`RolesGuard` globales
// (4.0) exigen JWT + rol; `@Roles("ADMIN", "COBRADOR")` explícito (antes era
// un `@Roles()` vacío no-op — hallazgo de revisión: dejaba pasar a cualquier
// autenticado sin scoping real). El scoping por ruta del COBRADOR lo valida
// `ReceiptsService.getReceiptHtml`, no el controller.
@Controller("payments")
export class ReceiptsController {
  constructor(private readonly receiptsService: ReceiptsService) {}

  @Roles("ADMIN", "COBRADOR")
  @Get(":pagoId/receipt")
  @Header("Content-Type", "text/html; charset=utf-8")
  async getReceiptHtml(
    @Param("pagoId") pagoId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<string> {
    return this.receiptsService.getReceiptHtml(pagoId, user);
  }
}

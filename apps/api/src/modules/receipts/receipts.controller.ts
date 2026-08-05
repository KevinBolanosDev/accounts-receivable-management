import { Controller, Get, Header, Param } from "@nestjs/common";
import { receiptSchema, type Receipt } from "@repo/types";

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

  // JSON del recibo (a diferencia del handler de arriba, que sirve el HTML
  // standalone). Lo usa `ReceiptScreen`: justo después de cobrar, el front
  // navega a esta pantalla solo con el `pagoId` y necesita reconstruir el
  // mensaje de WhatsApp (cliente, producto, monto, `reciboPublicUrl`) sin
  // tener ya el `CobroResponse` a mano.
  @Roles("ADMIN", "COBRADOR")
  @Get(":pagoId")
  async getReceipt(
    @Param("pagoId") pagoId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Receipt> {
    return receiptSchema.parse(await this.receiptsService.getReceipt(pagoId, user));
  }
}

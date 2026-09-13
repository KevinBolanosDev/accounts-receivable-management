import { Controller, Get, Param, StreamableFile } from "@nestjs/common";
import { receiptSchema, type Receipt } from "@repo/types";

import type { AuthenticatedUser } from "../../core/auth/auth-request";
import { CurrentUser } from "../../core/auth/current-user.decorator";
import { Roles } from "../../core/auth/roles.decorator";
import { buildReceiptPdf, receiptPdfFilename } from "./receipt-pdf";
import { ReceiptsService } from "./receipts.service";

// Fase 4 — Recibo. `JwtAuthGuard`/`RolesGuard` globales (4.0) exigen JWT +
// rol; `@Roles("ADMIN", "COBRADOR")` explícito (antes era un `@Roles()` vacío
// no-op — hallazgo de revisión: dejaba pasar a cualquier autenticado sin
// scoping real). El scoping por ruta del COBRADOR lo valida
// `ReceiptsService.getReceiptPdf`, no el controller.
@Controller("payments")
export class ReceiptsController {
  constructor(private readonly receiptsService: ReceiptsService) {}

  // El recibo es un PDF (antes era HTML server-rendered). `inline` y no
  // `attachment`: el front lo monta en un iframe para verlo en pantalla, y la
  // descarga la dispara el navegador desde el visor o el botón del front.
  @Roles("ADMIN", "COBRADOR")
  @Get(":pagoId/receipt")
  async getReceiptPdf(
    @Param("pagoId") pagoId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<StreamableFile> {
    const receipt = await this.receiptsService.getReceipt(pagoId, user);
    return new StreamableFile(await buildReceiptPdf(receipt), {
      type: "application/pdf",
      disposition: `inline; filename="${receiptPdfFilename(receipt.codigo)}"`,
    });
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

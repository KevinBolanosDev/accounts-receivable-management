import { Controller, Get, Param, StreamableFile, UseGuards } from "@nestjs/common";
import {
  clientCreditDetailSchema,
  clientCreditListItemSchema,
  clientCreditSummarySchema,
  type ClientCreditDetail,
  type ClientCreditListItem,
  type ClientCreditSummary,
} from "@repo/types";

import type { AuthenticatedUser } from "../../core/auth/auth-request";
import { CurrentUser } from "../../core/auth/current-user.decorator";
import { MustChangePasswordGuard } from "../../core/auth/must-change-password.guard";
import { Roles } from "../../core/auth/roles.decorator";

import { buildReceiptPdf, receiptPdfFilename } from "../receipts/receipt-pdf";
import { ClientPortalService } from "./client-portal.service";

// Fase 4 — portal de solo lectura del cliente autenticado (`rol: "CLIENTE"`).
// `JwtAuthGuard` + `RolesGuard` son globales (4.0); acá solo se agrega
// `MustChangePasswordGuard` (no es global — solo aplica a este controller y a
// `client-auth.me`). Con `mustChangePassword=true`, todo este controller
// responde 428 hasta que el cliente cambie la temporal.
@Controller("client-portal")
@UseGuards(MustChangePasswordGuard)
@Roles("CLIENTE")
export class ClientPortalController {
  constructor(private readonly clientPortalService: ClientPortalService) {}

  @Get("credits")
  async getMyCredits(@CurrentUser() user: AuthenticatedUser): Promise<ClientCreditListItem[]> {
    return clientCreditListItemSchema
      .array()
      .parse(await this.clientPortalService.getMyCredits(user));
  }

  @Get("summary")
  async getSummary(@CurrentUser() user: AuthenticatedUser): Promise<ClientCreditSummary> {
    return clientCreditSummarySchema.parse(await this.clientPortalService.getSummary(user));
  }

  @Get("credits/:id")
  async getCreditDetail(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ClientCreditDetail> {
    return clientCreditDetailSchema.parse(await this.clientPortalService.getCreditDetail(id, user));
  }

  // El cliente ve el recibo de sus propios pagos por esta vía (no por
  // `GET /payments/:pagoId/receipt`, que es del staff con otro scoping) —
  // decisión #15 de FASE_4_SUBFASES.md.
  @Get("payments/:pagoId/receipt")
  async getPaymentReceipt(
    @Param("pagoId") pagoId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<StreamableFile> {
    const receipt = await this.clientPortalService.getPaymentReceipt(pagoId, user);
    return new StreamableFile(await buildReceiptPdf(receipt), {
      type: "application/pdf",
      disposition: `inline; filename="${receiptPdfFilename(receipt.codigo)}"`,
    });
  }
}

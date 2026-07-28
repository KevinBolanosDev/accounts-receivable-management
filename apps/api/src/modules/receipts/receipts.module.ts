import { Module } from "@nestjs/common";

import { PublicReceiptsController } from "./public-receipts.controller";
import { ReceiptsController } from "./receipts.controller";
import { ReceiptsService } from "./receipts.service";

@Module({
  controllers: [ReceiptsController, PublicReceiptsController],
  providers: [ReceiptsService],
  // Exportado para que `ClientPortalModule` lo reuse en
  // `GET /client-portal/payments/:pagoId/receipt` — mismo HTML, sin duplicar
  // la plantilla (ver Fase 4.12).
  exports: [ReceiptsService],
})
export class ReceiptsModule {}

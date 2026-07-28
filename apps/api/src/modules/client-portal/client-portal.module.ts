import { Module } from "@nestjs/common";

import { ReceiptsModule } from "../receipts/receipts.module";
import { ClientPortalController } from "./client-portal.controller";
import { ClientPortalService } from "./client-portal.service";

@Module({
  // `ReceiptsModule` exporta `ReceiptsService` — el cliente ve su recibo con
  // la misma plantilla HTML que usa el staff, sin duplicarla (Fase 4.12).
  imports: [ReceiptsModule],
  controllers: [ClientPortalController],
  providers: [ClientPortalService],
})
export class ClientPortalModule {}

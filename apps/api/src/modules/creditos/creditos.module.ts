import { Module } from "@nestjs/common";

import { CreditosController } from "./creditos.controller";
import { CreditosRepository } from "./creditos.repository";
import { CreditosService } from "./creditos.service";

@Module({
  controllers: [CreditosController],
  providers: [CreditosService, CreditosRepository],
})
export class CreditosModule {}

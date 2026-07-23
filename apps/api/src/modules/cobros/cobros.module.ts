import { Module } from "@nestjs/common";

import { CobrosController } from "./cobros.controller";
import { CobrosRepository } from "./cobros.repository";
import { CobrosService } from "./cobros.service";

@Module({
  controllers: [CobrosController],
  providers: [CobrosService, CobrosRepository],
})
export class CobrosModule {}

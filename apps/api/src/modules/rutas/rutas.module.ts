import { Module } from "@nestjs/common";

import { RutasController } from "./rutas.controller";
import { RutasRepository } from "./rutas.repository";
import { RutasService } from "./rutas.service";

@Module({
  controllers: [RutasController],
  providers: [RutasService, RutasRepository],
})
export class RutasModule {}

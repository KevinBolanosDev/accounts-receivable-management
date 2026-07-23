import { Module } from "@nestjs/common";

import { ClientesController } from "./clientes.controller";
import { ClientsRepository } from "./clients.repository";
import { ClientsService } from "./clients.service";

@Module({
  controllers: [ClientesController],
  providers: [ClientsService, ClientsRepository],
})
export class ClientesModule {}

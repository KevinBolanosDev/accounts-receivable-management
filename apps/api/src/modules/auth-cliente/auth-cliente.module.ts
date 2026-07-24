import { Module } from "@nestjs/common";

import { AuthClienteController } from "./auth-cliente.controller";
import { AuthClienteRepository } from "./auth-cliente.repository";
import { AuthClienteService } from "./auth-cliente.service";

@Module({
  controllers: [AuthClienteController],
  providers: [AuthClienteService, AuthClienteRepository],
})
export class AuthClienteModule {}

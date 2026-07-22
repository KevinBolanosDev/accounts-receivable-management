import { Module } from "@nestjs/common";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";

// JwtService llega inyectado desde CoreAuthModule (@Global, ver app.module.ts)
// — no hace falta reimportar JwtModule aquí.
@Module({
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}

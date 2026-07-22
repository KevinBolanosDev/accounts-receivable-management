import { Global, Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";

import { JwtAuthGuard } from "./jwt-auth.guard";
import { RolesGuard } from "./roles.guard";

// Infra transversal de auth (igual que PrismaModule): una sola configuración
// de JwtModule, global, para que cualquier módulo firme/verifique tokens sin
// tener que reimportar nada. modules/auth (login) y estos Guards comparten
// esta misma instancia de JwtService.
@Global()
@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        // getOrThrow: el schema de Zod (env.schema.ts) ya garantiza que existen.
        secret: config.getOrThrow<string>("JWT_SECRET"),
        signOptions: {
          // `expiresIn` exige el tipo de marca `StringValue` de la librería `ms`
          // (p.ej. "1d"); el env var es un string validado por Zod, no un valor libre.
          expiresIn: config.getOrThrow<string>("JWT_EXPIRES_IN") as unknown as number,
        },
      }),
    }),
  ],
  providers: [JwtAuthGuard, RolesGuard],
  exports: [JwtModule, JwtAuthGuard, RolesGuard],
})
export class CoreAuthModule {}

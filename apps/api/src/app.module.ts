import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { validateEnv } from "./core/config/env.schema";
import { PrismaModule } from "./core/prisma/prisma.module";
import { CoreAuthModule } from "./core/auth/core-auth.module";
import { HealthModule } from "./modules/health/health.module";
import { AuthModule } from "./modules/auth/auth.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    PrismaModule,
    CoreAuthModule,
    HealthModule,
    AuthModule,
  ],
})
export class AppModule {}

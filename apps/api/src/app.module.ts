import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { validateEnv } from "./core/config/env.schema";
import { PrismaModule } from "./core/prisma/prisma.module";
import { CoreAuthModule } from "./core/auth/core-auth.module";
import { HealthModule } from "./modules/health/health.module";
import { AuthModule } from "./modules/auth/auth.module";
import { RutasModule } from "./modules/rutas/rutas.module";
import { UsuariosModule } from "./modules/usuarios/usuarios.module";
import { StorageModule } from "./core/storage/storage.module";
import { ClientesModule } from "./modules/clientes/clientes.module";
import { ProductosModule } from "./modules/productos/productos.module";
import { CreditosModule } from "./modules/creditos/creditos.module";
import { CobrosModule } from "./modules/cobros/cobros.module";

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
    RutasModule,
    UsuariosModule,
    StorageModule,
    ClientesModule,
    ProductosModule,
    CreditosModule,
    CobrosModule,
  ],
})
export class AppModule {}

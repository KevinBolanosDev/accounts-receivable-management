import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { validateEnv } from "./core/config/env.schema";
import { PrismaModule } from "./core/prisma/prisma.module";
import { CoreAuthModule } from "./core/auth/core-auth.module";
import { JwtAuthGuard } from "./core/auth/jwt-auth.guard";
import { RolesGuard } from "./core/auth/roles.guard";
import { HealthModule } from "./modules/health/health.module";
import { AuthModule } from "./modules/auth/auth.module";
import { RutasModule } from "./modules/rutas/rutas.module";
import { UsuariosModule } from "./modules/usuarios/usuarios.module";
import { StorageModule } from "./core/storage/storage.module";
import { ClientesModule } from "./modules/clientes/clientes.module";
import { ProductosModule } from "./modules/productos/productos.module";
import { CreditosModule } from "./modules/creditos/creditos.module";
import { CobrosModule } from "./modules/cobros/cobros.module";
import { AuthClienteModule } from "./modules/auth-cliente/auth-cliente.module";
import { ReceiptsModule } from "./modules/receipts/receipts.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    PrismaModule,
    CoreAuthModule,
    // Fase 4 — rate-limit por IP. Default 10 req/min global; el login del
    // cliente usa `@Throttle({ default: { limit: 5, ttl: 60_000 } })` local
    // para endurecer ese endpoint (el `documento` es enumerable, la única
    // defensa contra fuerza bruta es esta).
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 10 }]),
    HealthModule,
    AuthModule,
    RutasModule,
    UsuariosModule,
    StorageModule,
    ClientesModule,
    ProductosModule,
    CreditosModule,
    CobrosModule,
    AuthClienteModule,
    ReceiptsModule,
  ],
  providers: [
    // Orden de ejecución = orden de registro. El throttler corre primero
    // (no depende de `request.user`); antes solo estaba configurado el
    // `ThrottlerModule` sin el guard, así que `@Throttle(...)` no se
    // aplicaba en ningún endpoint (bug detectado en revisión de Fase 4).
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}

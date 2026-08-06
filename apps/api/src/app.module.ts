import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { ScheduleModule } from "@nestjs/schedule";
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
import { ClientPortalModule } from "./modules/client-portal/client-portal.module";
import { DailyClosuresModule } from "./modules/daily-closures/daily-closures.module";
import { DashboardModule } from "./modules/dashboard/dashboard.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    PrismaModule,
    CoreAuthModule,
    // Fase 4 — rate-limit por IP. El default es un techo anti-abuso, NO una
    // cuota de uso: una sola pantalla del admin dispara 3-5 requests, y con
    // el límite anterior (10/min) un usuario normal se auto-bloqueaba a los
    // pocos segundos de navegar. Los endpoints sensibles se endurecen uno
    // por uno con `@Throttle(...)` local — el login del cliente usa 5/min
    // porque el `documento` es enumerable y esa es su única defensa contra
    // fuerza bruta.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 200 }]),
    // Fase 5 — habilita `@Cron(...)` (el cierre automático de rutas,
    // `daily-closures.cron.ts`). El registro es incondicional; lo que decide
    // si el cron corre de verdad es `DAILY_CLOSURE_CRON_ENABLED` (apagado por
    // default), chequeado dentro del handler, no acá.
    ScheduleModule.forRoot(),
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
    ClientPortalModule,
    DailyClosuresModule,
    DashboardModule,
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

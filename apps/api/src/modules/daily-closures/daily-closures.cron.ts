import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Cron } from "@nestjs/schedule";

import { startOfLocalDay } from "../../core/domain/day-boundary.util";
import { CLOSURE_TIMEZONE, DAILY_CLOSURE_CRON } from "../../core/reports/closure-policy";

import { DailyClosuresRepository } from "./daily-closures.repository";
import { DailyClosuresService } from "./daily-closures.service";

// Cierre automático — apagado por default (`DAILY_CLOSURE_CRON_ENABLED`). El
// cierre manual con `closedById` es el camino auditable; el cron es
// conveniencia, y "apagado por default" es la decisión explícita: no debe
// cerrar rutas a medias durante la jornada solo por estar habilitado.
@Injectable()
export class DailyClosuresCron {
  private readonly logger = new Logger(DailyClosuresCron.name);

  constructor(
    private readonly config: ConfigService,
    private readonly repository: DailyClosuresRepository,
    private readonly service: DailyClosuresService,
  ) {}

  @Cron(DAILY_CLOSURE_CRON)
  async closeOpenRoutes(): Promise<void> {
    if (this.config.get<boolean>("DAILY_CLOSURE_CRON_ENABLED") !== true) {
      return;
    }

    const date = startOfLocalDay(new Date(), CLOSURE_TIMEZONE);
    const routes = await this.repository.findActiveRoutesMissingClosure(date);

    let cerradas = 0;
    for (const route of routes) {
      // Secuencial, no `Promise.all`: cada `close` ya es su propia
      // transacción atómica; en paralelo no aporta nada acá (es un job de
      // fondo, no una request con SLA) y evita saturar el pool de conexiones
      // si un tenant tiene muchas rutas.
      const closed = await this.service.closeAutomatically(route.id, route.adminId);
      if (closed) cerradas += 1;
    }

    this.logger.log(`Cierre automático: ${cerradas} de ${routes.length} rutas cerradas.`);
  }
}

import { Controller, Get } from "@nestjs/common";
import { dashboardSummarySchema, type DashboardSummary } from "@repo/types";

import type { AuthenticatedUser } from "../../core/auth/auth-request";
import { CurrentUser } from "../../core/auth/current-user.decorator";
import { Roles } from "../../core/auth/roles.decorator";

import { DashboardService } from "./dashboard.service";

// El dashboard es ADMIN-only: agrega sobre TODO el tenant (todas las rutas,
// todos los créditos), no algo que un COBRADOR deba ver scoped a sí mismo.
@Controller("dashboard")
@Roles("ADMIN")
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get("summary")
  async getSummary(@CurrentUser() user: AuthenticatedUser): Promise<DashboardSummary> {
    return dashboardSummarySchema.parse(await this.dashboardService.getSummary(user));
  }
}

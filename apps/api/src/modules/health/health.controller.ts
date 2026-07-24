import { Controller, Get } from "@nestjs/common";
import type { HealthStatus } from "@repo/types";
import { Public } from "../../core/auth/public.decorator";
import { HealthService } from "./health.service";

@Controller("health")
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Public()
  @Get()
  check(): Promise<HealthStatus> {
    return this.healthService.check();
  }
}

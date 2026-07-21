import { Injectable } from "@nestjs/common";
import type { HealthStatus } from "@repo/types";
import { PrismaService } from "../../core/prisma/prisma.service";

@Injectable()
export class HealthService {
  constructor(private readonly prisma: PrismaService) {}

  async check(): Promise<HealthStatus> {
    return {
      status: "ok",
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      database: await this.checkDatabase(),
    };
  }

  private async checkDatabase(): Promise<"up" | "down"> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return "up";
    } catch {
      return "down";
    }
  }
}

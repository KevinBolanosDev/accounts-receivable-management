import { Controller, Get, Param, Post, Query, StreamableFile } from "@nestjs/common";
import {
  closurePreviewSchema,
  dailyClosureListItemSchema,
  dailyClosureListQuerySchema,
  dailyClosureSchema,
  type ClosurePreview,
  type DailyClosure,
  type DailyClosureListItem,
  type DailyClosureListQuery,
} from "@repo/types";

import type { AuthenticatedUser } from "../../core/auth/auth-request";
import { CurrentUser } from "../../core/auth/current-user.decorator";
import { Roles } from "../../core/auth/roles.decorator";
import { ZodValidationPipe } from "../../core/pipes/zod-validation.pipe";

import { buildClosurePdf } from "./closure-pdf";
import { DailyClosuresService } from "./daily-closures.service";

// Fase 5.7/5.8 — el scoping por ruta del COBRADOR lo valida el service
// (`assertRouteAccess`), no el controller. Mismo criterio que `cobros`.
@Controller("daily-closures")
@Roles("ADMIN", "COBRADOR")
export class DailyClosuresController {
  constructor(private readonly dailyClosuresService: DailyClosuresService) {}

  // Resumen en vivo del día actual — no persiste. COBRADOR solo su ruta (403).
  @Get("preview/:routeId")
  async preview(
    @Param("routeId") routeId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ClosurePreview> {
    return closurePreviewSchema.parse(await this.dailyClosuresService.preview(routeId, user));
  }

  // Cierra la ruta para HOY. Recierre de `(ruta, hoy)` → 409, atómico.
  @Post(":routeId")
  async close(
    @Param("routeId") routeId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<DailyClosure> {
    return dailyClosureSchema.parse(await this.dailyClosuresService.close(routeId, user));
  }

  // Histórico con filtros. ADMIN ve todo su tenant; COBRADOR solo sus rutas.
  @Get()
  async list(
    @Query(new ZodValidationPipe(dailyClosureListQuerySchema)) query: DailyClosureListQuery,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<DailyClosureListItem[]> {
    const rows = await this.dailyClosuresService.list(query, user);
    return dailyClosureListItemSchema.array().parse(rows);
  }

  // Detalle del snapshot congelado (con `unpaidClients`). Nunca recalcula.
  @Get(":id")
  async getById(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<DailyClosure> {
    return dailyClosureSchema.parse(await this.dailyClosuresService.getById(id, user));
  }

  // PDF generado on-demand desde el snapshot — nunca toca Storage.
  @Get(":id/pdf")
  async getPdf(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<StreamableFile> {
    const closure = await this.dailyClosuresService.getForPdf(id, user);
    const buffer = await buildClosurePdf(closure);
    return new StreamableFile(buffer, {
      type: "application/pdf",
      disposition: `inline; filename="${pdfFilename(closure.rutaNombre, closure.date)}"`,
    });
  }
}

function pdfFilename(rutaNombre: string, date: string): string {
  const slug = rutaNombre
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "") // quita los acentos ya separados por NFD
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  return `cierre-${slug}-${date}.pdf`;
}

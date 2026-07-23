import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import {
  createRutaRequestSchema,
  rutaDetailSchema,
  rutaListItemSchema,
  updateRutaRequestSchema,
  type CreateRutaRequest,
  type RutaDetail,
  type RutaListItem,
  type UpdateRutaRequest,
} from "@repo/types";

import { CurrentUser } from "../../core/auth/current-user.decorator";
import { JwtAuthGuard } from "../../core/auth/jwt-auth.guard";
import { Roles } from "../../core/auth/roles.decorator";
import { RolesGuard } from "../../core/auth/roles.guard";
import { ZodValidationPipe } from "../../core/pipes/zod-validation.pipe";
import type { AuthenticatedUser } from "../../core/auth/auth-request";
import { RutasService } from "./rutas.service";

@Controller("routes")
@UseGuards(JwtAuthGuard)
export class RutasController {
  constructor(private readonly rutasService: RutasService) {}

  @Get()
  async findAll(@CurrentUser() user: AuthenticatedUser): Promise<RutaListItem[]> {
    const rutas = await this.rutasService.findAll(user);
    return rutaListItemSchema.array().parse(rutas);
  }

  @Get(":id")
  async findOne(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<RutaDetail> {
    const ruta = await this.rutasService.findOne(id, user);
    return rutaDetailSchema.parse(ruta);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles("ADMIN")
  async create(
    @Body(new ZodValidationPipe(createRutaRequestSchema)) body: CreateRutaRequest,
  ): Promise<RutaListItem> {
    const ruta = await this.rutasService.create(body);
    return rutaListItemSchema.parse(ruta);
  }

  @Patch(":id")
  @UseGuards(RolesGuard)
  @Roles("ADMIN")
  async update(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateRutaRequestSchema)) body: UpdateRutaRequest,
  ): Promise<RutaListItem> {
    const ruta = await this.rutasService.update(id, body);
    return rutaListItemSchema.parse(ruta);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(RolesGuard)
  @Roles("ADMIN")
  async remove(@Param("id") id: string): Promise<void> {
    await this.rutasService.remove(id);
  }
}

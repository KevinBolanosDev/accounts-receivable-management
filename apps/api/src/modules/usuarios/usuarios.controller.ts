import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import {
  cobradorListItemSchema,
  createCobradorRequestSchema,
  updateCobradorRequestSchema,
  usuariosQuerySchema,
  type CobradorListItem,
  type CreateCobradorRequest,
  type UpdateCobradorRequest,
  type UsuariosQuery,
} from "@repo/types";

import { JwtAuthGuard } from "../../core/auth/jwt-auth.guard";
import { Roles } from "../../core/auth/roles.decorator";
import { RolesGuard } from "../../core/auth/roles.guard";
import { ZodValidationPipe } from "../../core/pipes/zod-validation.pipe";
import { UsuariosService } from "./usuarios.service";

@Controller("users")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("ADMIN")
export class UsuariosController {
  constructor(private readonly usuariosService: UsuariosService) {}

  @Get()
  async findAll(
    @Query(new ZodValidationPipe(usuariosQuerySchema)) query: UsuariosQuery,
  ): Promise<CobradorListItem[]> {
    return cobradorListItemSchema.array().parse(await this.usuariosService.findAll(query.rol));
  }

  @Post()
  async create(
    @Body(new ZodValidationPipe(createCobradorRequestSchema)) body: CreateCobradorRequest,
  ): Promise<CobradorListItem> {
    return cobradorListItemSchema.parse(await this.usuariosService.create(body));
  }

  @Patch(":id")
  async update(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateCobradorRequestSchema)) body: UpdateCobradorRequest,
  ): Promise<CobradorListItem> {
    return cobradorListItemSchema.parse(await this.usuariosService.update(id, body));
  }
}

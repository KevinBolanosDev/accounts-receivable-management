import { Body, Controller, Get, Param, Patch, Post, Query } from "@nestjs/common";
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

import type { AuthenticatedUser } from "../../core/auth/auth-request";
import { CurrentUser } from "../../core/auth/current-user.decorator";
import { Roles } from "../../core/auth/roles.decorator";
import { ZodValidationPipe } from "../../core/pipes/zod-validation.pipe";
import { UsuariosService } from "./usuarios.service";

@Controller("users")
@Roles("ADMIN")
export class UsuariosController {
  constructor(private readonly usuariosService: UsuariosService) {}

  @Get()
  async findAll(
    @Query(new ZodValidationPipe(usuariosQuerySchema)) query: UsuariosQuery,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<CobradorListItem[]> {
    return cobradorListItemSchema
      .array()
      .parse(await this.usuariosService.findAll(query.rol, user));
  }

  @Post()
  async create(
    @Body(new ZodValidationPipe(createCobradorRequestSchema)) body: CreateCobradorRequest,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<CobradorListItem> {
    return cobradorListItemSchema.parse(await this.usuariosService.create(body, user));
  }

  @Patch(":id")
  async update(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateCobradorRequestSchema)) body: UpdateCobradorRequest,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<CobradorListItem> {
    return cobradorListItemSchema.parse(await this.usuariosService.update(id, body, user));
  }
}

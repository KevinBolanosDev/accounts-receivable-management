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
  Query,
} from "@nestjs/common";
import {
  createCreditoRequestSchema,
  creditoDetailSchema,
  creditoListItemSchema,
  creditosQuerySchema,
  updateCreditoRequestSchema,
  type CreateCreditoRequest,
  type Credito,
  type CreditoDetail,
  type CreditoListItem,
  type CreditosQuery,
  type UpdateCreditoRequest,
} from "@repo/types";

import type { AuthenticatedUser } from "../../core/auth/auth-request";
import { CurrentUser } from "../../core/auth/current-user.decorator";
import { Roles } from "../../core/auth/roles.decorator";
import { ZodValidationPipe } from "../../core/pipes/zod-validation.pipe";

import { CreditosService } from "./creditos.service";

@Controller("credits")
export class CreditosController {
  constructor(private readonly creditosService: CreditosService) {}

  @Get()
  async findAll(
    @Query(new ZodValidationPipe(creditosQuerySchema)) query: CreditosQuery,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<CreditoListItem[]> {
    const items = await this.creditosService.findAll(user, query);
    return creditoListItemSchema.array().parse(items);
  }

  @Get(":id")
  async findOne(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<CreditoDetail> {
    return creditoDetailSchema.parse(await this.creditosService.findOne(id, user));
  }

  @Post()
  async create(
    @Body(new ZodValidationPipe(createCreditoRequestSchema)) body: CreateCreditoRequest,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Credito> {
    const created = await this.creditosService.create(body, user);
    return creditoListItemSchema.parse(created);
  }

  @Patch(":id")
  async update(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateCreditoRequestSchema)) body: UpdateCreditoRequest,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Credito> {
    const updated = await this.creditosService.update(id, body, user);
    return creditoListItemSchema.parse(updated);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.OK)
  @Roles("ADMIN")
  async anular(@Param("id") id: string): Promise<Credito> {
    const result = await this.creditosService.anular(id);
    return creditoListItemSchema.parse(result);
  }
}

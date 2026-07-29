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
} from "@nestjs/common";
import {
  assignClientsRequestSchema,
  createRutaRequestSchema,
  rutaDetailSchema,
  rutaListItemSchema,
  updateRutaRequestSchema,
  type AssignClientsRequest,
  type CreateRutaRequest,
  type RutaDetail,
  type RutaListItem,
  type UpdateRutaRequest,
} from "@repo/types";

import { CurrentUser } from "../../core/auth/current-user.decorator";
import { Roles } from "../../core/auth/roles.decorator";
import { ZodValidationPipe } from "../../core/pipes/zod-validation.pipe";
import type { AuthenticatedUser } from "../../core/auth/auth-request";
import { RutasService } from "./rutas.service";

// `GET /routes` y `GET /routes/:id` no tenían `@Roles` propio (a diferencia
// de create/update/delete/assign, que ya eran ADMIN-only) — un CLIENTE
// autenticado podía listar todas las rutas (hallazgo de auditoría, ver
// PLAN_DESARROLLO §1.1). Los handlers ADMIN-only mantienen su propio
// `@Roles("ADMIN")`, que sigue ganando por handler.
@Controller("routes")
@Roles("ADMIN", "COBRADOR")
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
  @Roles("ADMIN")
  async create(
    @Body(new ZodValidationPipe(createRutaRequestSchema)) body: CreateRutaRequest,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<RutaListItem> {
    const ruta = await this.rutasService.create(body, user);
    return rutaListItemSchema.parse(ruta);
  }

  @Patch(":id")
  @Roles("ADMIN")
  async update(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateRutaRequestSchema)) body: UpdateRutaRequest,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<RutaListItem> {
    const ruta = await this.rutasService.update(id, body, user);
    return rutaListItemSchema.parse(ruta);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles("ADMIN")
  async remove(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser): Promise<void> {
    await this.rutasService.remove(id, user);
  }

  // Asignar/quitar clientes de una ruta (§3 — cierre de Fase 3, pantalla de
  // Ruta). ADMIN-only, igual que create/update/delete de la ruta misma.
  @Post(":id/clients")
  @Roles("ADMIN")
  async assignClients(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(assignClientsRequestSchema)) body: AssignClientsRequest,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<RutaDetail> {
    const ruta = await this.rutasService.assignClientes(id, body.clienteIds, user);
    return rutaDetailSchema.parse(ruta);
  }

  @Delete(":id/clients/:clienteId")
  @Roles("ADMIN")
  async unassignClient(
    @Param("id") id: string,
    @Param("clienteId") clienteId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<RutaDetail> {
    const ruta = await this.rutasService.unassignCliente(id, clienteId, user);
    return rutaDetailSchema.parse(ruta);
  }
}

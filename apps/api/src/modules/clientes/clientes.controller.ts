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
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { memoryStorage } from "multer";
import {
  clienteDetailSchema,
  clienteListItemSchema,
  clientesSummarySchema,
  createClienteRequestSchema,
  clientesQuerySchema,
  generateAccessResponseSchema,
  updateClienteRequestSchema,
  uploadFotoDocumentoResponseSchema,
  type ClienteDetail,
  type ClienteListItem,
  type ClientesQuery,
  type ClientesSummary,
  type CreateClienteRequest,
  type GenerateAccessResponse,
  type UpdateClienteRequest,
  type UploadFotoDocumentoResponse,
} from "@repo/types";

import type { AuthenticatedUser } from "../../core/auth/auth-request";
import { CurrentUser } from "../../core/auth/current-user.decorator";
import { Roles } from "../../core/auth/roles.decorator";
import { ImageFileValidationPipe } from "../../core/pipes/image-file-validation.pipe";
import { StorageService } from "../../core/storage/storage.service";
import { ZodValidationPipe } from "../../core/pipes/zod-validation.pipe";
import { ClientsService } from "./clients.service";

// `CLIENTE` comparte el mismo JwtAuthGuard/RolesGuard global que el staff
// desde Fase 4 — sin este `@Roles` de clase, cualquier cliente autenticado
// podía leer/crear/editar clientes ajenos y, más grave, resetear el acceso
// de OTRO cliente vía `/access` (hallazgo de auditoría, ver PLAN_DESARROLLO
// §1.1 y ESTADO_ACTUAL §7.2). `remove` mantiene su propio `@Roles("ADMIN")`,
// que sigue ganando por handler (Reflector.getAllAndOverride).
@Controller("clients")
@Roles("ADMIN", "COBRADOR")
export class ClientesController {
  constructor(
    private readonly clientsService: ClientsService,
    private readonly storageService: StorageService,
  ) {}

  @Get()
  async findAll(
    @Query(new ZodValidationPipe(clientesQuerySchema)) query: ClientesQuery,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ClienteListItem[]> {
    return clienteListItemSchema.array().parse(await this.clientsService.findAll(user, query));
  }

  // Debe ir ANTES de `:id` — si no, Nest matchea "summary" como el :id.
  @Get("summary")
  async summary(@CurrentUser() user: AuthenticatedUser): Promise<ClientesSummary> {
    return clientesSummarySchema.parse(await this.clientsService.summary(user));
  }

  @Get(":id")
  async findOne(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ClienteDetail> {
    return clienteDetailSchema.parse(await this.clientsService.findOne(id, user));
  }

  @Post()
  async create(
    @Body(new ZodValidationPipe(createClienteRequestSchema)) body: CreateClienteRequest,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ClienteDetail> {
    return clienteDetailSchema.parse(await this.clientsService.create(body, user));
  }

  @Patch(":id")
  async update(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateClienteRequestSchema)) body: UpdateClienteRequest,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ClienteDetail> {
    return clienteDetailSchema.parse(await this.clientsService.update(id, body, user));
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles("ADMIN")
  async remove(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser): Promise<void> {
    await this.clientsService.remove(id, user);
  }

  // Fase 4.13 — genera/resetea la contraseña temporal del portal del
  // cliente. ADMIN o COBRADOR de la ruta del cliente (scoping en el service).
  @Post(":id/access")
  async generateAccess(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<GenerateAccessResponse> {
    return generateAccessResponseSchema.parse(await this.clientsService.generateAccess(id, user));
  }

  @Delete(":id/access")
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteAccess(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.clientsService.deleteAccess(id, user);
  }

  @Post("id-document-photo")
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(
    FileInterceptor("file", {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  async uploadFotoDocumento(
    @UploadedFile(new ImageFileValidationPipe()) file: Express.Multer.File,
  ): Promise<UploadFotoDocumentoResponse> {
    const fotoDocumentoUrl = await this.storageService.uploadImagen(file.buffer, file.mimetype);
    return uploadFotoDocumentoResponseSchema.parse({ fotoDocumentoUrl });
  }
}

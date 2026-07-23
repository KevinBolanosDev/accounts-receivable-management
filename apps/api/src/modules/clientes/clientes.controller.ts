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
  UseGuards,
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
  updateClienteRequestSchema,
  uploadFotoDocumentoResponseSchema,
  type ClienteDetail,
  type ClienteListItem,
  type ClientesQuery,
  type ClientesSummary,
  type CreateClienteRequest,
  type UpdateClienteRequest,
  type UploadFotoDocumentoResponse,
} from "@repo/types";

import type { AuthenticatedUser } from "../../core/auth/auth-request";
import { CurrentUser } from "../../core/auth/current-user.decorator";
import { JwtAuthGuard } from "../../core/auth/jwt-auth.guard";
import { Roles } from "../../core/auth/roles.decorator";
import { RolesGuard } from "../../core/auth/roles.guard";
import { ImageFileValidationPipe } from "../../core/pipes/image-file-validation.pipe";
import { StorageService } from "../../core/storage/storage.service";
import { ZodValidationPipe } from "../../core/pipes/zod-validation.pipe";
import { ClientsService } from "./clients.service";

@Controller("clients")
@UseGuards(JwtAuthGuard)
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
  @UseGuards(RolesGuard)
  @Roles("ADMIN")
  async remove(@Param("id") id: string): Promise<void> {
    await this.clientsService.remove(id);
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

import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import {
  createProductoRequestSchema,
  productoSchema,
  updateProductoRequestSchema,
  type CreateProductoRequest,
  type Producto,
  type UpdateProductoRequest,
} from "@repo/types";

import type { AuthenticatedUser } from "../../core/auth/auth-request";
import { CurrentUser } from "../../core/auth/current-user.decorator";
import { Roles } from "../../core/auth/roles.decorator";
import { ZodValidationPipe } from "../../core/pipes/zod-validation.pipe";

import { ProductosService } from "./productos.service";

// `GET /products` no tenía `@Roles` propio — un CLIENTE autenticado podía
// leer el catálogo (hallazgo de auditoría, ver PLAN_DESARROLLO §1.1). Sin
// uso legítimo para el portal del cliente; `create`/`update` mantienen su
// propio `@Roles("ADMIN")`.
@Controller("products")
@Roles("ADMIN", "COBRADOR")
export class ProductosController {
  constructor(private readonly productosService: ProductosService) {}

  @Get()
  async findAll(@CurrentUser() user: AuthenticatedUser): Promise<Producto[]> {
    const rows = await this.productosService.findAll(user);
    return productoSchema.array().parse(rows);
  }

  @Post()
  @Roles("ADMIN")
  async create(
    @Body(new ZodValidationPipe(createProductoRequestSchema)) body: CreateProductoRequest,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Producto> {
    const created = await this.productosService.create(body, user);
    return productoSchema.parse(created);
  }

  @Patch(":id")
  @Roles("ADMIN")
  async update(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateProductoRequestSchema)) body: UpdateProductoRequest,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Producto> {
    const updated = await this.productosService.update(id, body, user);
    return productoSchema.parse(updated);
  }
}

// (El controller re-parsea cada salida con el schema de @repo/types; el service
// ya hace Decimal → number al toDto. Esta doble verificación es la convención
// de los módulos CRUD de Fase 2 (clientes, rutas).)

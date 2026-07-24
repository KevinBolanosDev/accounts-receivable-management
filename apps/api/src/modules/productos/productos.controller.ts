import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import {
  createProductoRequestSchema,
  productoSchema,
  updateProductoRequestSchema,
  type CreateProductoRequest,
  type Producto,
  type UpdateProductoRequest,
} from "@repo/types";

import { CurrentUser } from "../../core/auth/current-user.decorator";
import { Roles } from "../../core/auth/roles.decorator";
import { ZodValidationPipe } from "../../core/pipes/zod-validation.pipe";

import { ProductosService } from "./productos.service";

@Controller("products")
export class ProductosController {
  constructor(private readonly productosService: ProductosService) {}

  @Get()
  async findAll(): Promise<Producto[]> {
    const rows = await this.productosService.findAll();
    return productoSchema.array().parse(rows);
  }

  @Post()
  @Roles("ADMIN")
  async create(
    @Body(new ZodValidationPipe(createProductoRequestSchema)) body: CreateProductoRequest,
  ): Promise<Producto> {
    const created = await this.productosService.create(body);
    return productoSchema.parse(created);
  }

  @Patch(":id")
  @Roles("ADMIN")
  async update(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateProductoRequestSchema)) body: UpdateProductoRequest,
  ): Promise<Producto> {
    const updated = await this.productosService.update(id, body);
    return productoSchema.parse(updated);
  }
}

// (El controller re-parsea cada salida con el schema de @repo/types; el service
// ya hace Decimal → number al toDto. Esta doble verificación es la convención
// de los módulos CRUD de Fase 2 (clientes, rutas).)
void CurrentUser;

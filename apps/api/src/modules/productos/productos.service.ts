import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { CreateProductoRequest, Producto, UpdateProductoRequest } from "@repo/types";

import type { AuthenticatedUser } from "../../core/auth/auth-request";
import { requireAdminId } from "../../core/auth/tenant.util";
import { ProductosRepository, type ProductoRow } from "./productos.repository";

@Injectable()
export class ProductosService {
  constructor(private readonly productosRepository: ProductosRepository) {}

  findAll(user: AuthenticatedUser): Promise<Producto[]> {
    return this.productosRepository.findMany(requireAdminId(user)).then((rows) => rows.map(toDto));
  }

  async findById(id: string, user: AuthenticatedUser): Promise<Producto> {
    const row = await this.productosRepository.findById(id, requireAdminId(user));
    if (!row) throw new NotFoundException("Producto no encontrado.");
    return toDto(row);
  }

  async create(body: CreateProductoRequest, user: AuthenticatedUser): Promise<Producto> {
    try {
      const row = await this.productosRepository.create({
        nombre: body.nombre,
        precioBase: new Prisma.Decimal(body.precioBase),
        admin: { connect: { id: requireAdminId(user) } },
      });
      return toDto(row);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ConflictException("Ya existe un producto con ese nombre.");
      }
      throw error;
    }
  }

  async update(
    id: string,
    body: UpdateProductoRequest,
    user: AuthenticatedUser,
  ): Promise<Producto> {
    const existing = await this.productosRepository.findById(id, requireAdminId(user));
    if (!existing) throw new NotFoundException("Producto no encontrado.");

    try {
      const row = await this.productosRepository.update(id, {
        nombre: body.nombre ?? undefined,
        precioBase: body.precioBase !== undefined ? new Prisma.Decimal(body.precioBase) : undefined,
        activo: body.activo ?? undefined,
      });
      return toDto(row);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ConflictException("Ya existe un producto con ese nombre.");
      }
      throw error;
    }
  }
}

// Convierte la fila de Prisma al shape del contrato `@repo/types`. Decimal → number.
function toDto(row: ProductoRow): Producto {
  return {
    id: row.id,
    nombre: row.nombre,
    precioBase: Number(row.precioBase.toString()),
  };
}

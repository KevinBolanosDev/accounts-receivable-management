import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { CreateProductoRequest, Producto, UpdateProductoRequest } from "@repo/types";

import { ProductosRepository, type ProductoRow } from "./productos.repository";

@Injectable()
export class ProductosService {
  constructor(private readonly productosRepository: ProductosRepository) {}

  findAll(): Promise<Producto[]> {
    return this.productosRepository.findMany().then((rows) => rows.map(toDto));
  }

  async findById(id: string): Promise<Producto> {
    const row = await this.productosRepository.findById(id);
    if (!row) throw new NotFoundException("Producto no encontrado.");
    return toDto(row);
  }

  async create(body: CreateProductoRequest): Promise<Producto> {
    try {
      const row = await this.productosRepository.create({
        nombre: body.nombre,
        precioBase: new Prisma.Decimal(body.precioBase),
      });
      return toDto(row);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ConflictException("Ya existe un producto con ese nombre.");
      }
      throw error;
    }
  }

  async update(id: string, body: UpdateProductoRequest): Promise<Producto> {
    const existing = await this.productosRepository.findById(id);
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

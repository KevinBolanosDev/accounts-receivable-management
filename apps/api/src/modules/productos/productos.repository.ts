import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";

import { PrismaService } from "../../core/prisma/prisma.service";

export type ProductoRow = Prisma.ProductoGetPayload<Record<string, never>>;

// Capa de acceso a datos pura: solo Prisma, cero reglas de negocio.
@Injectable()
export class ProductosRepository {
  constructor(private readonly prisma: PrismaService) {}

  findMany(args: { activo?: boolean } = {}): Promise<ProductoRow[]> {
    return this.prisma.producto.findMany({
      where: { activo: args.activo ?? true },
      orderBy: { nombre: "asc" },
    });
  }

  findById(id: string): Promise<ProductoRow | null> {
    return this.prisma.producto.findUnique({ where: { id } });
  }

  create(data: Prisma.ProductoCreateInput): Promise<ProductoRow> {
    return this.prisma.producto.create({ data });
  }

  update(id: string, data: Prisma.ProductoUpdateInput): Promise<ProductoRow> {
    return this.prisma.producto.update({ where: { id }, data });
  }
}

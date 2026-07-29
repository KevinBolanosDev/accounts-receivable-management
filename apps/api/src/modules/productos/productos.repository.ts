import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";

import { PrismaService } from "../../core/prisma/prisma.service";

export type ProductoRow = Prisma.ProductoGetPayload<Record<string, never>>;

// Capa de acceso a datos pura: solo Prisma, cero reglas de negocio.
@Injectable()
export class ProductosRepository {
  constructor(private readonly prisma: PrismaService) {}

  // `adminId` es obligatorio en ambas lecturas: el catálogo es por tenant y no
  // existe ningún caso de uso que deba leer el de todos los admins a la vez.
  findMany(adminId: string, args: { activo?: boolean } = {}): Promise<ProductoRow[]> {
    return this.prisma.producto.findMany({
      where: { adminId, activo: args.activo ?? true },
      orderBy: { nombre: "asc" },
    });
  }

  findById(id: string, adminId: string): Promise<ProductoRow | null> {
    return this.prisma.producto.findFirst({ where: { id, adminId } });
  }

  create(data: Prisma.ProductoCreateInput): Promise<ProductoRow> {
    return this.prisma.producto.create({ data });
  }

  update(id: string, data: Prisma.ProductoUpdateInput): Promise<ProductoRow> {
    return this.prisma.producto.update({ where: { id }, data });
  }
}

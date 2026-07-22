import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";

import { PrismaService } from "../../core/prisma/prisma.service";

const rutaListInclude = {
  cobrador: { select: { id: true, nombre: true, telefono: true } },
  _count: { select: { clientes: true } },
} satisfies Prisma.RutaInclude;

const rutaDetailInclude = {
  ...rutaListInclude,
  clientes: {
    include: { ruta: { select: { id: true, nombre: true } } },
  },
} satisfies Prisma.RutaInclude;

export type RutaWithCount = Prisma.RutaGetPayload<{ include: typeof rutaListInclude }>;
export type RutaWithDetail = Prisma.RutaGetPayload<{ include: typeof rutaDetailInclude }>;

// Capa de acceso a datos pura: solo Prisma, cero reglas de negocio, cero auth.
// El service decide el `where` (scoping por rol) y llama a estos métodos.
@Injectable()
export class RutasRepository {
  constructor(private readonly prisma: PrismaService) {}

  findMany(where?: Prisma.RutaWhereInput): Promise<RutaWithCount[]> {
    return this.prisma.ruta.findMany({
      where,
      include: rutaListInclude,
      orderBy: { nombre: "asc" },
    });
  }

  findById(id: string, where?: Prisma.RutaWhereInput): Promise<RutaWithDetail | null> {
    return this.prisma.ruta.findFirst({
      where: { ...where, id },
      include: rutaDetailInclude,
    });
  }

  create(data: Prisma.RutaCreateInput): Promise<RutaWithCount> {
    return this.prisma.ruta.create({ data, include: rutaListInclude });
  }

  update(id: string, data: Prisma.RutaUpdateInput): Promise<RutaWithCount> {
    return this.prisma.ruta.update({ where: { id }, data, include: rutaListInclude });
  }

  countClientes(rutaId: string): Promise<number> {
    return this.prisma.cliente.count({ where: { rutaId } });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.ruta.delete({ where: { id } });
  }
}

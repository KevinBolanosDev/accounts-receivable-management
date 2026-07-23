import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";

import { PrismaService } from "../../core/prisma/prisma.service";

const cobradorInclude = {
  rutas: {
    select: {
      id: true,
      nombre: true,
      _count: { select: { clientes: { where: { activo: true } } } },
    },
  },
} satisfies Prisma.UsuarioInclude;

export type CobradorWithRelations = Prisma.UsuarioGetPayload<{ include: typeof cobradorInclude }>;

@Injectable()
export class UsuariosRepository {
  constructor(private readonly prisma: PrismaService) {}

  findMany(where?: Prisma.UsuarioWhereInput): Promise<CobradorWithRelations[]> {
    return this.prisma.usuario.findMany({
      where,
      include: cobradorInclude,
      orderBy: { nombre: "asc" },
    });
  }

  findById(id: string): Promise<CobradorWithRelations | null> {
    return this.prisma.usuario.findUnique({ where: { id }, include: cobradorInclude });
  }

  create(data: Prisma.UsuarioCreateInput): Promise<CobradorWithRelations> {
    return this.prisma.usuario.create({ data, include: cobradorInclude });
  }

  update(id: string, data: Prisma.UsuarioUpdateInput): Promise<CobradorWithRelations> {
    return this.prisma.usuario.update({ where: { id }, data, include: cobradorInclude });
  }

  async assignRoute(usuarioId: string, rutaId: string | null): Promise<void> {
    if (rutaId === null) {
      await this.prisma.ruta.updateMany({
        where: { cobradorId: usuarioId },
        data: { cobradorId: null },
      });
      return;
    }

    await this.prisma.$transaction([
      this.prisma.ruta.updateMany({ where: { cobradorId: usuarioId }, data: { cobradorId: null } }),
      this.prisma.ruta.update({ where: { id: rutaId }, data: { cobradorId: usuarioId } }),
    ]);
  }
}

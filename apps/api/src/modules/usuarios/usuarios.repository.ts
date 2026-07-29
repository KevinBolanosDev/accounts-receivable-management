import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";

import { PrismaService } from "../../core/prisma/prisma.service";

const cobradorInclude = {
  rutas: {
    select: {
      id: true,
      nombre: true,
      _count: { select: { clientAdmins: { where: { activo: true } } } },
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

  findById(id: string, where?: Prisma.UsuarioWhereInput): Promise<CobradorWithRelations | null> {
    return this.prisma.usuario.findFirst({ where: { ...where, id }, include: cobradorInclude });
  }

  create(data: Prisma.UsuarioCreateInput): Promise<CobradorWithRelations> {
    return this.prisma.usuario.create({ data, include: cobradorInclude });
  }

  update(id: string, data: Prisma.UsuarioUpdateInput): Promise<CobradorWithRelations> {
    return this.prisma.usuario.update({ where: { id }, data, include: cobradorInclude });
  }

  // `adminId` acota ambas escrituras al tenant. En el segundo paso se usa
  // `updateMany` en vez de `update` justamente para poder filtrar por `adminId`
  // además del id: con `update` (que solo acepta el unique) un admin podía
  // apropiarse de la ruta de otro pasando su id.
  async assignRoute(usuarioId: string, rutaId: string | null, adminId: string): Promise<void> {
    if (rutaId === null) {
      await this.prisma.ruta.updateMany({
        where: { cobradorId: usuarioId, adminId },
        data: { cobradorId: null },
      });
      return;
    }

    await this.prisma.$transaction([
      this.prisma.ruta.updateMany({
        where: { cobradorId: usuarioId, adminId },
        data: { cobradorId: null },
      }),
      this.prisma.ruta.updateMany({
        where: { id: rutaId, adminId },
        data: { cobradorId: usuarioId },
      }),
    ]);
  }

  // Baja lógica del cobrador + liberación de sus rutas, atómica: una ruta sin
  // cobrador es un estado válido (la vuelve a asignar el admin), pero una ruta
  // asignada a un cobrador inactivo no lo es.
  //
  // `updateMany` en ambos pasos por el mismo motivo que `assignRoute`: es la
  // única forma de filtrar por `adminId` además del id. `Pago` no se toca —
  // el histórico de cobros conserva su autor.
  async softDelete(id: string, adminId: string): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.ruta.updateMany({
        where: { cobradorId: id, adminId },
        data: { cobradorId: null },
      }),
      this.prisma.usuario.updateMany({
        where: { id, adminId, rol: "COBRADOR" },
        data: { activo: false },
      }),
    ]);
  }
}

import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";

import { PrismaService } from "../../core/prisma/prisma.service";

const rutaWriteInclude = {
  cobrador: { select: { id: true, nombre: true, telefono: true } },
  _count: { select: { clientes: true } },
} satisfies Prisma.RutaInclude;

export type RutaWithCount = Prisma.RutaGetPayload<{ include: typeof rutaWriteInclude }>;

// El include de lectura (list/detail) depende del rango de fecha de "hoy"
// (dinámico por request), así que se construye por función en vez de una
// constante `satisfies` a nivel de módulo. Trae, por cada cliente activo de
// la ruta, TODOS sus créditos (para derivar saldo/estado/porcentaje con el
// helper compartido de `core/domain/credito-cliente.util`) y solo los Pagos
// de HOY (para derivar `cobroHoy` sin traer el historial completo).
function buildRutaReadInclude(desde: Date, hasta: Date) {
  return {
    cobrador: { select: { id: true, nombre: true, telefono: true } },
    clientes: {
      where: { activo: true },
      include: {
        ruta: { select: { id: true, nombre: true } },
        creditos: {
          include: {
            producto: { select: { nombre: true } },
            pagos: {
              where: { fecha: { gte: desde, lt: hasta } },
              orderBy: { fecha: "desc" },
            },
          },
        },
      },
    },
  } satisfies Prisma.RutaInclude;
}

export type RutaWithClientesHoy = Prisma.RutaGetPayload<{
  include: ReturnType<typeof buildRutaReadInclude>;
}>;

// Capa de acceso a datos pura: solo Prisma, cero reglas de negocio, cero auth.
// El service decide el `where` (scoping por rol) y llama a estos métodos.
@Injectable()
export class RutasRepository {
  constructor(private readonly prisma: PrismaService) {}

  findMany(
    where: Prisma.RutaWhereInput | undefined,
    hoy: { desde: Date; hasta: Date },
  ): Promise<RutaWithClientesHoy[]> {
    return this.prisma.ruta.findMany({
      where,
      include: buildRutaReadInclude(hoy.desde, hoy.hasta),
      orderBy: { nombre: "asc" },
    });
  }

  findById(
    id: string,
    where: Prisma.RutaWhereInput | undefined,
    hoy: { desde: Date; hasta: Date },
  ): Promise<RutaWithClientesHoy | null> {
    return this.prisma.ruta.findFirst({
      where: { ...where, id },
      include: buildRutaReadInclude(hoy.desde, hoy.hasta),
    });
  }

  create(data: Prisma.RutaCreateInput): Promise<RutaWithCount> {
    return this.prisma.ruta.create({ data, include: rutaWriteInclude });
  }

  update(id: string, data: Prisma.RutaUpdateInput): Promise<RutaWithCount> {
    return this.prisma.ruta.update({ where: { id }, data, include: rutaWriteInclude });
  }

  countClientes(rutaId: string): Promise<number> {
    return this.prisma.cliente.count({ where: { rutaId } });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.ruta.delete({ where: { id } });
  }
}

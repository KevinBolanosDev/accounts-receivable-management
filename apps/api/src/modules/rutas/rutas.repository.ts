import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";

import { PrismaService } from "../../core/prisma/prisma.service";

const rutaWriteInclude = {
  cobrador: { select: { id: true, nombre: true, telefono: true } },
  _count: { select: { clientAdmins: { where: { activo: true } } } },
} satisfies Prisma.RutaInclude;

export type RutaWithCount = Prisma.RutaGetPayload<{ include: typeof rutaWriteInclude }>;

// El include de lectura (list/detail) depende del rango de fecha de "hoy"
// (dinámico por request) Y del tenant (`adminId`): los clientes de esta ruta
// pueden ser cartera compartida con otro admin, y sus créditos con ESE otro
// admin (cada Credito lleva su propio `adminId`) nunca deben aparecer acá.
// Por eso se construye por función en vez de una constante `satisfies` a
// nivel de módulo. La ruta ya no tiene `clientes` directo (ese back-relation
// vivía en `Cliente.rutaId`, que se movió a `ClientAdmin.rutaId`): se llega a
// los clientes atravesando `clientAdmins` (la relación cliente↔admin), y por
// cada uno se trae, del cliente, TODOS sus créditos DE ESTE ADMIN (para
// derivar saldo/estado/porcentaje con el helper compartido de
// `core/domain/credito-cliente.util`) y solo los Pagos de HOY (para derivar
// `cobroHoy` sin traer el historial completo).
function buildRutaReadInclude(adminId: string, desde: Date, hasta: Date) {
  return {
    cobrador: { select: { id: true, nombre: true, telefono: true } },
    clientAdmins: {
      where: { activo: true },
      include: {
        client: {
          include: {
            creditos: {
              where: { adminId },
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
    adminId: string,
    hoy: { desde: Date; hasta: Date },
  ): Promise<RutaWithClientesHoy[]> {
    return this.prisma.ruta.findMany({
      where,
      include: buildRutaReadInclude(adminId, hoy.desde, hoy.hasta),
      orderBy: { nombre: "asc" },
    });
  }

  findById(
    id: string,
    where: Prisma.RutaWhereInput | undefined,
    adminId: string,
    hoy: { desde: Date; hasta: Date },
  ): Promise<RutaWithClientesHoy | null> {
    return this.prisma.ruta.findFirst({
      where: { ...where, id },
      include: buildRutaReadInclude(adminId, hoy.desde, hoy.hasta),
    });
  }

  create(data: Prisma.RutaCreateInput): Promise<RutaWithCount> {
    return this.prisma.ruta.create({ data, include: rutaWriteInclude });
  }

  update(id: string, data: Prisma.RutaUpdateInput): Promise<RutaWithCount> {
    return this.prisma.ruta.update({ where: { id }, data, include: rutaWriteInclude });
  }

  countClientes(rutaId: string): Promise<number> {
    return this.prisma.clientAdmin.count({ where: { rutaId } });
  }

  // Para validar que el cobrador que se asigna a una ruta pertenece al mismo
  // tenant que la ruta.
  findCobradorById(id: string): Promise<{ id: string; adminId: string | null } | null> {
    return this.prisma.usuario.findFirst({
      where: { id, rol: "COBRADOR" },
      select: { id: true, adminId: true },
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.ruta.delete({ where: { id } });
  }

  // Asignar/quitar clientes de una ruta (§3 — cierre de Fase 3, pantalla de
  // Ruta). `unassignCliente` solo toca el cliente si de verdad pertenece a
  // ESTA ruta (evita una carrera con una reasignación concurrente a otra ruta).
  // Operan sobre `ClientAdmin` (la relación cliente↔admin), no sobre
  // `Cliente`: la ruta es propiedad de ESA relación, no del cliente global.
  // `adminId` acota el updateMany al tenant: sin él, bastaba con conocer el id
  // de un cliente de OTRO admin para arrastrarlo a una ruta propia — y ahora,
  // además, es lo que elige CUÁL relación tocar si el cliente es cartera de
  // más de un admin.
  assignClientes(
    rutaId: string,
    clienteIds: string[],
    adminId: string,
  ): Promise<Prisma.BatchPayload> {
    return this.prisma.clientAdmin.updateMany({
      where: { clientId: { in: clienteIds }, adminId },
      data: { rutaId },
    });
  }

  unassignCliente(
    rutaId: string,
    clienteId: string,
    adminId: string,
  ): Promise<Prisma.BatchPayload> {
    return this.prisma.clientAdmin.updateMany({
      where: { clientId: clienteId, rutaId, adminId },
      data: { rutaId: null },
    });
  }
}

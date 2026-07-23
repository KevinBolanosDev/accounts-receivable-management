import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";

import { PrismaService } from "../../core/prisma/prisma.service";

const clientListInclude = {
  ruta: { select: { id: true, nombre: true } },
} satisfies Prisma.ClienteInclude;

// Fase 3 — el detalle carga los créditos del cliente para llenar
// `creditosActivos` (ACTIVO/MORA) y `creditosHistorial` (PAGADO/ANULADO) del
// `ClienteDetail`. Esto se hace en Prisma (no en service), respetando el
// principio de no-acoplamiento: clientes y créditos comparten MODELOS
// (Prisma global) pero nunca se importan los services entre sí.
const clientDetailInclude = {
  ruta: { select: { id: true, nombre: true, cobrador: { select: { nombre: true } } } },
  creditos: {
    include: {
      producto: { select: { id: true, nombre: true } },
      pagos: { select: { monto: true, fecha: true } },
    },
    orderBy: { fechaInicio: "desc" },
  },
} satisfies Prisma.ClienteInclude;

export type ClientWithRoute = Prisma.ClienteGetPayload<{ include: typeof clientListInclude }>;
export type ClientWithDetail = Prisma.ClienteGetPayload<{ include: typeof clientDetailInclude }>;

@Injectable()
export class ClientsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findMany(where?: Prisma.ClienteWhereInput): Promise<ClientWithRoute[]> {
    return this.prisma.cliente.findMany({
      where,
      include: clientListInclude,
      orderBy: { nombre: "asc" },
    });
  }

  findById(id: string, where?: Prisma.ClienteWhereInput): Promise<ClientWithDetail | null> {
    return this.prisma.cliente.findFirst({ where: { ...where, id }, include: clientDetailInclude });
  }

  create(data: Prisma.ClienteCreateInput): Promise<ClientWithDetail> {
    return this.prisma.cliente.create({ data, include: clientDetailInclude });
  }

  update(id: string, data: Prisma.ClienteUpdateInput): Promise<ClientWithDetail> {
    return this.prisma.cliente.update({ where: { id }, data, include: clientDetailInclude });
  }

  findRouteById(id: string): Promise<{ id: string; cobradorId: string | null } | null> {
    return this.prisma.ruta.findUnique({ where: { id }, select: { id: true, cobradorId: true } });
  }
}

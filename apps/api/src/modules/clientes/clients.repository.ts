import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";

import { PrismaService } from "../../core/prisma/prisma.service";

// El listado también trae los créditos (select liviano, sin `pagos`) para
// poder calcular `saldoPendiente`/`porcentajePagado`/`estado` igual que el
// detalle — antes `toListItem` los dejaba `undefined` porque este include no
// traía créditos, así que ningún listado (Admin "Clientes", cobrador "Mis
// clientes") mostraba saldo/estado/avance reales.
const clientListInclude = {
  ruta: { select: { id: true, nombre: true } },
  creditos: {
    select: {
      id: true,
      codigo: true,
      clienteId: true,
      monto: true,
      interes: true,
      dias: true,
      montoTotal: true,
      cuotaDiaria: true,
      saldoPendiente: true,
      estado: true,
      fechaInicio: true,
      producto: { select: { nombre: true } },
    },
  },
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

// Resumen (métricas de la vista Clientes del Cobrador): solo necesitamos los
// montos de cada crédito, no el detalle completo (producto/pagos) que carga
// `clientDetailInclude`.
const clientSummaryInclude = {
  creditos: { select: { montoTotal: true, saldoPendiente: true, estado: true } },
} satisfies Prisma.ClienteInclude;

export type ClientWithRoute = Prisma.ClienteGetPayload<{ include: typeof clientListInclude }>;
export type ClientWithDetail = Prisma.ClienteGetPayload<{ include: typeof clientDetailInclude }>;
export type ClientForSummary = Prisma.ClienteGetPayload<{ include: typeof clientSummaryInclude }>;

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

  findManyForSummary(where?: Prisma.ClienteWhereInput): Promise<ClientForSummary[]> {
    return this.prisma.cliente.findMany({ where, include: clientSummaryInclude });
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

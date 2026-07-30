import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";

import { PrismaService } from "../../core/prisma/prisma.service";

// Los includes se parametrizan por `adminId` para poder filtrar `admins` (la
// relación cliente↔admin) a la fila que corresponde al tenant del que hace la
// consulta — un cliente puede tener una fila `ClientAdmin` por cada admin que
// lo tiene como cartera, y esta capa solo debe exponer la del llamador.
// Seguro: el `where` de nivel superior (que arma el service) ya exige
// `admins: { some: { adminId, ... } }`, así que si el cliente aparece en el
// resultado, `admins` (filtrado por ese mismo `adminId`) siempre trae 1 fila.
const clientAdminRelationSelect = {
  rutaId: true,
  activo: true,
  ruta: { select: { id: true, nombre: true } },
} satisfies Prisma.ClientAdminSelect;

// El listado también trae los créditos (select liviano, sin `pagos`) para
// poder calcular `saldoPendiente`/`porcentajePagado`/`estado` igual que el
// detalle. Filtrados por `adminId`: un cliente compartido con otro admin
// puede tener créditos de ESE admin, que nunca deben aparecer acá (cada
// Credito lleva su propio `adminId`, ver `schema.prisma`).
function buildClientListInclude(adminId: string) {
  return {
    admins: { where: { adminId }, take: 1, select: clientAdminRelationSelect },
    creditos: {
      where: { adminId },
      select: {
        id: true,
        codigo: true,
        clienteId: true,
        monto: true,
        interes: true,
        frecuencia: true,
        cuotas: true,
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
}

// Fase 3 — el detalle carga los créditos del cliente para llenar
// `creditosActivos` (ACTIVO/MORA) y `creditosHistorial` (PAGADO/ANULADO) del
// `ClienteDetail`. Esto se hace en Prisma (no en service), respetando el
// principio de no-acoplamiento: clientes y créditos comparten MODELOS
// (Prisma global) pero nunca se importan los services entre sí.
function buildClientDetailInclude(adminId: string) {
  return {
    admins: {
      where: { adminId },
      take: 1,
      select: {
        rutaId: true,
        activo: true,
        ruta: { select: { id: true, nombre: true, cobrador: { select: { nombre: true } } } },
      },
    },
    creditos: {
      where: { adminId },
      include: {
        producto: { select: { id: true, nombre: true } },
        // `id`, `cobradorId`, `cobrador.nombre` y `reciboUrl` son necesarios para
        // construir el historial REAL: sin ellos el service fabricaba un `id`
        // sintético y forzaba `reciboUrl: null`, así que el front nunca podía
        // abrir ni compartir el recibo de un pago del historial.
        // Orden ascendente: `buildPaymentHistory` numera las cuotas por posición.
        pagos: {
          select: {
            id: true,
            monto: true,
            fecha: true,
            cobradorId: true,
            reciboUrl: true,
            cobrador: { select: { nombre: true } },
          },
          orderBy: { fecha: "asc" },
        },
      },
      orderBy: { fechaInicio: "desc" },
    },
  } satisfies Prisma.ClienteInclude;
}

// Resumen (métricas de la vista Clientes del Cobrador): solo necesitamos los
// montos de cada crédito, no el detalle completo (producto/pagos) que carga
// `clientDetailInclude`. Igual que arriba, filtrado por `adminId`.
function buildClientSummaryInclude(adminId: string) {
  return {
    creditos: {
      where: { adminId },
      select: { montoTotal: true, saldoPendiente: true, estado: true },
    },
  } satisfies Prisma.ClienteInclude;
}

export type ClientWithRoute = Prisma.ClienteGetPayload<{
  include: ReturnType<typeof buildClientListInclude>;
}>;
export type ClientWithDetail = Prisma.ClienteGetPayload<{
  include: ReturnType<typeof buildClientDetailInclude>;
}>;
export type ClientForSummary = Prisma.ClienteGetPayload<{
  include: ReturnType<typeof buildClientSummaryInclude>;
}>;

@Injectable()
export class ClientsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findMany(
    where: Prisma.ClienteWhereInput | undefined,
    adminId: string,
  ): Promise<ClientWithRoute[]> {
    return this.prisma.cliente.findMany({
      where,
      include: buildClientListInclude(adminId),
      orderBy: { nombre: "asc" },
    });
  }

  findManyForSummary(
    where: Prisma.ClienteWhereInput | undefined,
    adminId: string,
  ): Promise<ClientForSummary[]> {
    return this.prisma.cliente.findMany({ where, include: buildClientSummaryInclude(adminId) });
  }

  findById(
    id: string,
    where: Prisma.ClienteWhereInput | undefined,
    adminId: string,
  ): Promise<ClientWithDetail | null> {
    return this.prisma.cliente.findFirst({
      where: { ...where, id },
      include: buildClientDetailInclude(adminId),
    });
  }

  create(data: Prisma.ClienteCreateInput, adminId: string): Promise<ClientWithDetail> {
    return this.prisma.cliente.create({ data, include: buildClientDetailInclude(adminId) });
  }

  update(id: string, data: Prisma.ClienteUpdateInput, adminId: string): Promise<ClientWithDetail> {
    return this.prisma.cliente.update({
      where: { id },
      data,
      include: buildClientDetailInclude(adminId),
    });
  }

  findRouteById(
    id: string,
  ): Promise<{ id: string; cobradorId: string | null; adminId: string } | null> {
    return this.prisma.ruta.findUnique({
      where: { id },
      select: { id: true, cobradorId: true, adminId: true },
    });
  }
}

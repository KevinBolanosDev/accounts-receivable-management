import { Injectable } from "@nestjs/common";
import { Prisma, type PrismaClient } from "@prisma/client";

import { PrismaService } from "../../core/prisma/prisma.service";

type Tx = Omit<PrismaClient, "$connect" | "$disconnect">;

// Capa de datos pura: solo Prisma, cero reglas de negocio, cero auth — mismo
// principio que `clients.repository.ts`/`rutas.repository.ts`. El service
// decide el scoping (qué ruta, qué tenant) y arma el snapshot; acá solo se
// ejecutan los `where`/`include`/`create` que le pasan.

const closureInclude = {
  ruta: { select: { nombre: true } },
  closedBy: { select: { nombre: true } },
} satisfies Prisma.DailyClosureInclude;

export type DailyClosureRow = Prisma.DailyClosureGetPayload<{ include: typeof closureInclude }>;

// Créditos de los clientes ACTIVOS de una ruta, con TODOS sus pagos (no solo
// los de hoy) ordenados ascendente por fecha: `buildPaymentHistory` (dentro
// de `computeClosureSummary`) numera las cuotas por orden cronológico
// completo, así que pasarle solo los pagos de hoy correría la numeración.
const closureCreditInclude = {
  cliente: { select: { nombre: true, telefono: true } },
  pagos: {
    orderBy: { fecha: "asc" },
    include: { cobrador: { select: { nombre: true } } },
  },
} satisfies Prisma.CreditoInclude;

export type ClosureCreditDbRow = Prisma.CreditoGetPayload<{ include: typeof closureCreditInclude }>;

export interface CreateClosureData {
  routeId: string;
  date: Date;
  totalCollected: Prisma.Decimal;
  collectedCount: number;
  newCredits: number;
  newCreditsAmount: Prisma.Decimal;
  productsSold: number;
  unpaidClients: Prisma.InputJsonValue;
  unpaidCount: number;
  paidClients: Prisma.InputJsonValue;
  closedById: string | null;
}

@Injectable()
export class DailyClosuresRepository {
  constructor(private readonly prisma: PrismaService) {}

  findRouteById(
    id: string,
  ): Promise<{ id: string; nombre: string; adminId: string; cobradorId: string | null } | null> {
    return this.prisma.ruta.findUnique({
      where: { id },
      select: { id: true, nombre: true, adminId: true, cobradorId: true },
    });
  }

  /** Rutas de un COBRADOR dentro de su tenant, para el scoping de `list`. */
  findRouteIdsForCobrador(cobradorId: string, adminId: string): Promise<{ id: string }[]> {
    return this.prisma.ruta.findMany({
      where: { adminId, cobradorId },
      select: { id: true },
    });
  }

  // Todos los créditos (cualquier estado) de los clientes ACTIVOS de esta
  // ruta, en ESTE tenant. Cualquier estado y no solo ACTIVO: un pago cobrado
  // hoy en un crédito que hoy mismo quedó PAGADO sigue siendo plata cobrada
  // hoy — `computeClosureSummary` filtra por estado internamente solo para
  // la parte de MORA/sin-pagar.
  findCreditsForRoute(routeId: string, adminId: string): Promise<ClosureCreditDbRow[]> {
    return this.prisma.credito.findMany({
      where: {
        adminId,
        cliente: { admins: { some: { adminId, rutaId: routeId, activo: true } } },
      },
      include: closureCreditInclude,
    });
  }

  findClosureFor(routeId: string, date: Date): Promise<DailyClosureRow | null> {
    return this.prisma.dailyClosure.findUnique({
      where: { routeId_date: { routeId, date } },
      include: closureInclude,
    });
  }

  // El cierre MÁS RECIENTE de esta ruta, sin importar el día — es el punto de
  // partida del próximo cierre (`periodStart` en `computeClosureSummary`):
  // así un pago cobrado después de cerrar hoy, pero antes de medianoche, no
  // se pierde entre dos días calendario. `createdAt`, no `date`: `date` es
  // el día calendario del cierre, `createdAt` es el instante real hasta el
  // que ya se contó plata — el que importa para no duplicar ni perder pagos.
  findLastClosure(routeId: string): Promise<{ createdAt: Date } | null> {
    return this.prisma.dailyClosure.findFirst({
      where: { routeId },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });
  }

  findById(id: string): Promise<DailyClosureRow | null> {
    return this.prisma.dailyClosure.findUnique({ where: { id }, include: closureInclude });
  }

  findMany(where: Prisma.DailyClosureWhereInput): Promise<DailyClosureRow[]> {
    return this.prisma.dailyClosure.findMany({
      where,
      include: closureInclude,
      orderBy: { date: "desc" },
    });
  }

  /** Rutas activas de CUALQUIER tenant sin cierre para `date` — usa el cron. */
  findActiveRoutesMissingClosure(date: Date): Promise<{ id: string; adminId: string }[]> {
    return this.prisma.ruta.findMany({
      where: { activa: true, dailyClosures: { none: { date } } },
      select: { id: true, adminId: true },
    });
  }

  createClosure(tx: Tx, data: CreateClosureData): Promise<DailyClosureRow> {
    return tx.dailyClosure.create({ data, include: closureInclude });
  }

  /** Condicional (`estado: "ACTIVO"` en el WHERE): no pisa un crédito que un
   *  cobro concurrente ya dejó PAGADO, ni uno que ya estaba ANULADO. */
  markCreditsInArrears(tx: Tx, creditoIds: string[]): Promise<Prisma.BatchPayload> {
    if (creditoIds.length === 0) {
      return Promise.resolve({ count: 0 });
    }
    return tx.credito.updateMany({
      where: { id: { in: creditoIds }, estado: "ACTIVO" },
      data: { estado: "MORA" },
    });
  }
}

import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, type PrismaClient } from "@prisma/client";
import type {
  ClosurePayment,
  ClosurePreview,
  DailyClosure,
  DailyClosureListItem,
  DailyClosureListQuery,
  UnpaidClient,
} from "@repo/types";

import type { AuthenticatedUser } from "../../core/auth/auth-request";
import { requireAdminId } from "../../core/auth/tenant.util";
import { assertRouteAccess } from "../../core/domain/route-access.util";
import { computeClosureSummary, type ClosureCreditRow } from "../../core/domain/daily-closure.util";
import { startOfLocalDay } from "../../core/domain/day-boundary.util";
import { CLOSURE_TIMEZONE } from "../../core/reports/closure-policy";
import { PrismaService } from "../../core/prisma/prisma.service";

import {
  DailyClosuresRepository,
  type ClosureCreditDbRow,
  type DailyClosureRow,
} from "./daily-closures.repository";

type Tx = Omit<PrismaClient, "$connect" | "$disconnect">;
type PrismaTx = Prisma.TransactionClient;

// El service concentra la regla (scoping, cálculo vía `daily-closure.util`,
// congelado, materialización de MORA); el repository ejecuta el
// `where`/`create` que le pasan. Mismo patrón que `cobros` en Fase 3, ahora
// con agregación en vez de descuento — ver `performClose`.
@Injectable()
export class DailyClosuresService {
  constructor(
    private readonly repository: DailyClosuresRepository,
    private readonly prisma: PrismaService,
  ) {}

  async preview(routeId: string, user: AuthenticatedUser): Promise<ClosurePreview> {
    const route = await this.repository.findRouteById(routeId);
    assertRouteAccess(route, user, {
      forbidden: "Solo puedes ver el cierre de tus propias rutas.",
    });

    const adminId = requireAdminId(user);
    const now = new Date();
    const creditos = await this.loadClosureCredits(routeId, adminId);
    const periodStart = await this.resolvePeriodStart(routeId, now);
    const summary = computeClosureSummary({ creditos, date: now, periodStart });
    const existing = await this.repository.findClosureFor(
      routeId,
      startOfLocalDay(now, CLOSURE_TIMEZONE),
    );

    return {
      routeId,
      rutaNombre: route.nombre,
      date: startOfLocalDay(now, CLOSURE_TIMEZONE).toISOString().slice(0, 10),
      totalCollected: summary.totalCollected,
      collectedCount: summary.collectedCount,
      newCredits: summary.newCredits,
      newCreditsAmount: summary.newCreditsAmount,
      productsSold: summary.productsSold,
      unpaidClients: summary.unpaidClients,
      alreadyClosed: existing !== null,
    };
  }

  async close(routeId: string, user: AuthenticatedUser): Promise<DailyClosure> {
    const route = await this.repository.findRouteById(routeId);
    assertRouteAccess(route, user, { forbidden: "Solo puedes cerrar tus propias rutas." });

    const closed = await this.performClose(routeId, requireAdminId(user), user.sub);
    return toDto(closed);
  }

  // Cierre automático (cron): sin usuario HTTP, `closedById=null` distingue
  // "automático" de "manual" en el histórico. Idempotente por el
  // `@@unique([routeId, date])` — si la ruta ya se cerró entre el
  // `findActiveRoutesMissingClosure` del cron y este punto (ej. alguien la
  // cerró a mano un segundo antes), el P2002 se captura como no-op, nunca
  // como error.
  async closeAutomatically(routeId: string, adminId: string): Promise<boolean> {
    try {
      await this.performClose(routeId, adminId, null);
      return true;
    } catch (error) {
      if (error instanceof ConflictException) return false;
      throw error;
    }
  }

  async list(
    query: DailyClosureListQuery,
    user: AuthenticatedUser,
  ): Promise<DailyClosureListItem[]> {
    const adminId = requireAdminId(user);

    let routeIdFilter: Prisma.DailyClosureWhereInput["routeId"];
    if (user.rol === "COBRADOR") {
      const misRutas = await this.repository.findRouteIdsForCobrador(user.sub, adminId);
      const misRutaIds = misRutas.map((r) => r.id);
      if (query.routeId) {
        // Pide una ruta puntual: si no es suya, el resultado es vacío — nunca
        // las demás rutas del cobrador (filtrar "de más" sería una fuga).
        if (!misRutaIds.includes(query.routeId)) return [];
        routeIdFilter = query.routeId;
      } else {
        routeIdFilter = { in: misRutaIds };
      }
    } else if (query.routeId) {
      routeIdFilter = query.routeId;
    }

    const dateFilter: Prisma.DateTimeFilter = {};
    if (query.from) dateFilter.gte = new Date(`${query.from}T00:00:00.000Z`);
    if (query.to) dateFilter.lte = new Date(`${query.to}T00:00:00.000Z`);

    const rows = await this.repository.findMany({
      ruta: { adminId },
      ...(routeIdFilter ? { routeId: routeIdFilter } : {}),
      ...(Object.keys(dateFilter).length > 0 ? { date: dateFilter } : {}),
    });
    return rows.map(toListDto);
  }

  async getById(id: string, user: AuthenticatedUser): Promise<DailyClosure> {
    return toDto(await this.loadScoped(id, user));
  }

  // Fase 5.8 — fuente única para el PDF: el mismo DTO que `getById`, el
  // controller decide cómo renderizarlo (`buildClosurePdf`). No recalcula.
  async getForPdf(id: string, user: AuthenticatedUser): Promise<DailyClosure> {
    return toDto(await this.loadScoped(id, user));
  }

  private async loadScoped(id: string, user: AuthenticatedUser): Promise<DailyClosureRow> {
    const row = await this.repository.findById(id);
    if (!row) throw new NotFoundException("El cierre no existe.");

    const route = await this.repository.findRouteById(row.routeId);
    assertRouteAccess(route, user, {
      notFound: "El cierre no existe.",
      forbidden: "No tienes acceso a este cierre.",
    });

    return row;
  }

  private async loadClosureCredits(routeId: string, adminId: string): Promise<ClosureCreditRow[]> {
    const rows = await this.repository.findCreditsForRoute(routeId, adminId);
    return rows.map(toClosureCreditRow);
  }

  // Punto de partida del período que este cierre (o preview) va a contar:
  // el `createdAt` del último cierre de la ruta, o medianoche de hoy si
  // nunca se cerró antes. Ver el comentario grande en `computeClosureSummary`
  // — sin esto, un pago cobrado después de cerrar hoy se perdía de
  // cualquier cierre (ni el de hoy, ya congelado, ni el de mañana, que solo
  // miraba pagos de mañana).
  private async resolvePeriodStart(routeId: string, now: Date): Promise<Date> {
    const last = await this.repository.findLastClosure(routeId);
    return last?.createdAt ?? startOfLocalDay(now, CLOSURE_TIMEZONE);
  }

  // El corazón transaccional: congela el snapshot Y materializa la MORA, o
  // ninguno de los dos. `computeClosureSummary` corre FUERA de la
  // transacción (es cero I/O, no necesita estar dentro) — adentro solo van
  // las dos escrituras.
  private async performClose(
    routeId: string,
    adminId: string,
    closedById: string | null,
  ): Promise<DailyClosureRow> {
    const now = new Date();
    const creditos = await this.loadClosureCredits(routeId, adminId);
    const periodStart = await this.resolvePeriodStart(routeId, now);
    const summary = computeClosureSummary({ creditos, date: now, periodStart });
    const date = startOfLocalDay(now, CLOSURE_TIMEZONE);

    return this.prisma.$transaction(async (txParam) => {
      const tx = txParam as unknown as PrismaTx;

      let created: DailyClosureRow;
      try {
        created = await this.repository.createClosure(tx as unknown as Tx, {
          routeId,
          date,
          totalCollected: new Prisma.Decimal(summary.totalCollected),
          collectedCount: summary.collectedCount,
          newCredits: summary.newCredits,
          newCreditsAmount: new Prisma.Decimal(summary.newCreditsAmount),
          productsSold: summary.productsSold,
          // `ClosureUnpaidClient[]` es un JSON válido en runtime; el tipo de
          // Prisma para una columna `Json` (`InputJsonValue`) no lo acepta
          // estructuralmente sin este `unknown` de por medio.
          unpaidClients: summary.unpaidClients as unknown as Prisma.InputJsonValue,
          unpaidCount: summary.unpaidClients.length,
          paidClients: summary.paidClients as unknown as Prisma.InputJsonValue,
          closedById,
        });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
          throw new ConflictException("La ruta ya fue cerrada hoy.");
        }
        throw error;
      }

      if (summary.creditosEnMora.length > 0) {
        await this.repository.markCreditsInArrears(tx as unknown as Tx, summary.creditosEnMora);
      }

      return created;
    });
  }
}

function toClosureCreditRow(row: ClosureCreditDbRow): ClosureCreditRow {
  return {
    id: row.id,
    clienteId: row.clienteId,
    clienteNombre: row.cliente.nombre,
    clienteTelefono: row.cliente.telefono,
    estado: row.estado,
    fechaInicio: row.fechaInicio,
    cuotas: row.cuotas,
    frecuencia: row.frecuencia,
    montoTotal: Number(row.montoTotal.toString()),
    saldoPendiente: Number(row.saldoPendiente.toString()),
    pagos: row.pagos.map((p) => ({
      id: p.id,
      creditoId: p.creditoId,
      monto: Number(p.monto.toString()),
      fecha: p.fecha,
      cobradorId: p.cobradorId,
      cobradorNombre: p.cobrador.nombre,
      reciboUrl: p.reciboUrl,
      anulado: p.anulado,
    })),
  };
}

// === toDto: Decimal → number, Date → ISO string ==============================

function toDto(row: DailyClosureRow): DailyClosure {
  return {
    id: row.id,
    routeId: row.routeId,
    rutaNombre: row.ruta.nombre,
    date: row.date.toISOString().slice(0, 10),
    totalCollected: Number(row.totalCollected.toString()),
    collectedCount: row.collectedCount,
    newCredits: row.newCredits,
    newCreditsAmount: Number(row.newCreditsAmount.toString()),
    productsSold: row.productsSold,
    // `Json` en la base: confiamos en la forma porque este mismo service es
    // el único que la escribe (`performClose`); el controller vuelve a
    // validar contra `dailyClosureSchema` en la salida (convención del
    // proyecto), así que un shape corrupto igual no se cuela silencioso.
    unpaidClients: row.unpaidClients as unknown as UnpaidClient[],
    unpaidCount: row.unpaidCount,
    // `null` para cierres de antes de este campo (no se recalculan, ver el
    // comentario en `schema.prisma`) — el front lo distingue de "nadie pagó".
    paidClients: row.paidClients as unknown as ClosurePayment[] | null,
    status: row.status,
    closedByNombre: row.closedBy?.nombre ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

function toListDto(row: DailyClosureRow): DailyClosureListItem {
  return {
    id: row.id,
    routeId: row.routeId,
    rutaNombre: row.ruta.nombre,
    date: row.date.toISOString().slice(0, 10),
    totalCollected: Number(row.totalCollected.toString()),
    collectedCount: row.collectedCount,
    newCredits: row.newCredits,
    newCreditsAmount: Number(row.newCreditsAmount.toString()),
    productsSold: row.productsSold,
    unpaidCount: row.unpaidCount,
    status: row.status,
    closedByNombre: row.closedBy?.nombre ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

import { Injectable } from "@nestjs/common";
import type { DashboardRoute, DashboardSummary } from "@repo/types";

import type { AuthenticatedUser } from "../../core/auth/auth-request";
import { requireAdminId } from "../../core/auth/tenant.util";
import { computeAvanceDelDia } from "../../core/domain/credito-cliente.util";
import { isRouteClosedOn } from "../../core/domain/daily-closure.util";
import { dayRange, localDateKey, startOfLocalDay } from "../../core/domain/day-boundary.util";
import { CLOSURE_TIMEZONE } from "../../core/reports/closure-policy";
import { PrismaService } from "../../core/prisma/prisma.service";

const DAY_MS = 24 * 60 * 60 * 1000;

// Fase 5.9 — agregado de solo lectura del Admin. Sin repository:
// `PrismaService` directo, como `receipts`/`client-portal` (Fase 4) — es una
// vista cross-cutting que agrega por Prisma, no un CRUD.
@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary(user: AuthenticatedUser): Promise<DashboardSummary> {
    const adminId = requireAdminId(user);
    const now = new Date();
    const today = dayRange(now, CLOSURE_TIMEZONE);
    const weekStart = startOfLocalDay(new Date(now.getTime() - 6 * DAY_MS), CLOSURE_TIMEZONE);

    const [totalCollectedAgg, activeCredits, clientesEnMora, rutas, pagosDeLaSemana] =
      await Promise.all([
        this.prisma.pago.aggregate({
          where: {
            credito: { adminId },
            fecha: { gte: today.start, lt: today.end },
            anulado: false,
          },
          _sum: { monto: true },
        }),
        this.prisma.credito.count({ where: { adminId, estado: "ACTIVO" } }),
        this.prisma.credito.findMany({
          where: { adminId, estado: "MORA" },
          select: { clienteId: true },
          distinct: ["clienteId"],
        }),
        this.prisma.ruta.findMany({
          where: { adminId, activa: true },
          select: {
            id: true,
            nombre: true,
            dailyClosures: { where: { date: today.start }, select: { date: true } },
            clientAdmins: {
              where: { activo: true },
              select: {
                client: {
                  select: {
                    creditos: {
                      where: { adminId },
                      select: {
                        estado: true,
                        pagos: {
                          where: { fecha: { gte: today.start, lt: today.end }, anulado: false },
                          select: { monto: true },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          orderBy: { nombre: "asc" },
        }),
        this.prisma.pago.findMany({
          where: {
            credito: { adminId },
            fecha: { gte: weekStart, lt: today.end },
            anulado: false,
          },
          select: { monto: true, fecha: true },
        }),
      ]);

    const routesToday: DashboardRoute[] = rutas.map((ruta) => {
      const actividad: { elegible: boolean; cobrado: boolean }[] = [];
      let totalCobradoHoy = 0;

      for (const clientAdmin of ruta.clientAdmins) {
        let cobradoCliente = 0;
        let tieneActivo = false;
        for (const credito of clientAdmin.client.creditos) {
          if (credito.estado === "ACTIVO" || credito.estado === "MORA") tieneActivo = true;
          for (const pago of credito.pagos) {
            cobradoCliente += Number(pago.monto.toString());
          }
        }
        const cobrado = cobradoCliente > 0;
        actividad.push({ elegible: tieneActivo || cobrado, cobrado });
        totalCobradoHoy += cobradoCliente;
      }

      return {
        id: ruta.id,
        nombre: ruta.nombre,
        estadoDia: isRouteClosedOn(ruta.dailyClosures, now, CLOSURE_TIMEZONE)
          ? "cerrada"
          : "abierta",
        avanceDelDia: computeAvanceDelDia(actividad),
        totalCobradoHoy: Number(totalCobradoHoy.toFixed(2)),
      };
    });

    return {
      totalCollectedToday: Number(totalCollectedAgg._sum.monto?.toString() ?? "0"),
      activeCredits,
      clientsInArrears: clientesEnMora.length,
      openRoutes: routesToday.filter((r) => r.estadoDia === "abierta").length,
      routesToday,
      weeklyCollections: buildWeeklyCollections(pagosDeLaSemana, now),
    };
  }
}

// Suma por día calendario LOCAL (no UTC): un pago a las 23:30 Bogotá cae en
// el día en que de verdad se cobró, no en el UTC del día siguiente. Los días
// sin ningún pago quedan en 0 — `pagosDeLaSemana` solo trae los que sí
// existen, así que el relleno es responsabilidad de este helper.
function buildWeeklyCollections(
  pagos: { monto: { toString(): string }; fecha: Date }[],
  now: Date,
): { date: string; total: number }[] {
  const porDia = new Map<string, number>();
  for (const pago of pagos) {
    const key = localDateKey(pago.fecha, CLOSURE_TIMEZONE);
    porDia.set(key, (porDia.get(key) ?? 0) + Number(pago.monto.toString()));
  }

  return Array.from({ length: 7 }, (_, i) => {
    const offset = 6 - i; // i=0 → hace 6 días (el más viejo) … i=6 → hoy
    const key = localDateKey(new Date(now.getTime() - offset * DAY_MS), CLOSURE_TIMEZONE);
    return { date: key, total: Number((porDia.get(key) ?? 0).toFixed(2)) };
  });
}

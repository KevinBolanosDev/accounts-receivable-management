import { Injectable, NotFoundException } from "@nestjs/common";
import type {
  ClientCreditDetail,
  ClientCreditListItem,
  ClientCreditSummary,
  Receipt,
} from "@repo/types";

import type { AuthenticatedUser } from "../../core/auth/auth-request";
import { mapCreditoListItem } from "../../core/domain/credito-cliente.util";
import {
  buildPaymentHistory,
  computeProximaFechaCuota,
} from "../../core/domain/payment-schedule.util";
import { PrismaService } from "../../core/prisma/prisma.service";
import { ReceiptTokenService } from "../../core/receipts/receipt-token.service";
import { ReceiptsService } from "../receipts/receipts.service";

// Fase 4 — portal de solo lectura del cliente autenticado. Sin repository:
// es un feature de solo lectura que no comparte modelo de escritura con
// nadie (convención documentada en `receipts.service.ts`).
@Injectable()
export class ClientPortalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly receiptsService: ReceiptsService,
    private readonly receiptToken: ReceiptTokenService,
  ) {}

  // El chequeo de pertenencia (`pago.credito.clienteId === user.sub`) ya lo
  // hace `ReceiptsService.assertAccess` para `rol: "CLIENTE"` — este método
  // solo delega, no duplica esa lógica.
  getPaymentReceipt(pagoId: string, user: AuthenticatedUser): Promise<Receipt> {
    return this.receiptsService.getReceipt(pagoId, user);
  }

  async getMyCredits(user: AuthenticatedUser): Promise<ClientCreditListItem[]> {
    const rows = await this.prisma.credito.findMany({
      where: { clienteId: user.sub },
      include: { producto: { select: { nombre: true } } },
      orderBy: { fechaInicio: "desc" },
    });

    return rows.map((row) => {
      const item = mapCreditoListItem(row);
      return {
        ...item,
        proximaFechaCuota: computeProximaFechaCuota({
          fechaInicio: row.fechaInicio,
          cuotas: row.cuotas,
          frecuencia: row.frecuencia,
          cuotasPagadas: item.cuotasPagadas,
          estado: item.estado,
        }),
      };
    });
  }

  async getCreditDetail(id: string, user: AuthenticatedUser): Promise<ClientCreditDetail> {
    // `findFirst` con `clienteId: user.sub` en el `where` (no un `findUnique`
    // + chequeo aparte): un crédito de OTRO cliente ni siquiera matchea la
    // query, así que la respuesta es 404 genérico — no revela que el crédito
    // existe pero es ajeno (mismo criterio que `creditos.service.ts`).
    const row = await this.prisma.credito.findFirst({
      where: { id, clienteId: user.sub },
      include: {
        producto: { select: { nombre: true } },
        cliente: {
          select: {
            id: true,
            nombre: true,
            // Todas las relaciones cliente↔admin de este cliente (puede ser
            // cartera de varios) — se resuelve la de ESTE crédito abajo, por
            // `row.adminId` (Credito.adminId es explícito, ver schema).
            admins: { select: { adminId: true, ruta: { select: { id: true, nombre: true } } } },
          },
        },
        pagos: {
          orderBy: { fecha: "asc" },
          include: { cobrador: { select: { nombre: true } } },
        },
      },
    });
    if (!row) throw new NotFoundException("Crédito no encontrado.");

    const item = mapCreditoListItem(row);
    const proximaFechaCuota = computeProximaFechaCuota({
      fechaInicio: row.fechaInicio,
      cuotas: row.cuotas,
      frecuencia: row.frecuencia,
      cuotasPagadas: item.cuotasPagadas,
      estado: item.estado,
    });
    const relation = row.cliente.admins.find((a) => a.adminId === row.adminId);

    const pagos = buildPaymentHistory(
      { id: row.id, fechaInicio: row.fechaInicio, cuotas: row.cuotas, frecuencia: row.frecuencia },
      row.pagos.map((p) => ({
        id: p.id,
        creditoId: p.creditoId,
        monto: Number(p.monto.toString()),
        fecha: p.fecha,
        cobradorId: p.cobradorId,
        cobradorNombre: p.cobrador?.nombre ?? null,
        reciboUrl: p.reciboUrl ?? null,
        anulado: p.anulado,
      })),
      new Date(),
      (pagoId) => this.receiptToken.buildPublicUrl(pagoId),
    );

    return {
      ...item,
      proximaFechaCuota,
      cliente: {
        id: row.cliente.id,
        nombre: row.cliente.nombre,
        ruta: relation?.ruta ? { id: relation.ruta.id, nombre: relation.ruta.nombre } : null,
      },
      pagos,
    };
  }

  async getSummary(user: AuthenticatedUser): Promise<ClientCreditSummary> {
    const rows = await this.prisma.credito.findMany({
      where: { clienteId: user.sub },
      include: { producto: { select: { nombre: true } } },
    });
    const items = rows.map((row) => mapCreditoListItem(row));
    const activos = items.filter((c) => c.estado === "ACTIVO" || c.estado === "MORA");

    const montoTotalActivos = activos.reduce((sum, c) => sum + c.montoTotal, 0);
    const totalPagadoActivos = activos.reduce((sum, c) => sum + c.totalPagado, 0);
    const porcentajePagado =
      montoTotalActivos > 0
        ? Number(((totalPagadoActivos / montoTotalActivos) * 100).toFixed(2))
        : 0;

    return {
      saldoTotal: Number(activos.reduce((sum, c) => sum + c.saldoPendiente, 0).toFixed(2)),
      proximaCuota: activos[0]?.cuotaDiaria ?? null,
      porcentajePagado,
      creditosActivos: activos.length,
    };
  }
}

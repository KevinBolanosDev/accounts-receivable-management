import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type { Receipt, ReceiptInstallment } from "@repo/types";

import type { AuthenticatedUser } from "../../core/auth/auth-request";
import { requireAdminId } from "../../core/auth/tenant.util";
import { buildPaymentHistory } from "../../core/domain/payment-schedule.util";
import { buildReciboCodigo } from "../../core/domain/receipt-code.util";
import { PrismaService } from "../../core/prisma/prisma.service";
import { ReceiptTokenService } from "../../core/receipts/receipt-token.service";

type PagoAccessRow = {
  credito: {
    clienteId: string;
    // Explícito en el propio Credito (ver `schema.prisma`): un cliente puede
    // ser cartera de más de un admin, así que el tenant NO se puede derivar
    // de `cliente`.
    adminId: string;
    cliente: {
      // Todas las relaciones cliente↔admin de este cliente (normalmente 1).
      // Se resuelve la que corresponde a `credito.adminId` en `assertAccess`
      // — no se puede filtrar en la query porque ese valor es un campo
      // hermano dentro del mismo resultado, no algo conocido de antemano.
      admins: { adminId: string; ruta: { cobradorId: string | null } | null }[];
    };
  };
};

// Servicio del módulo `receipts` (Fase 4). No tiene repository propio —
// `Receipt` es un view-model agregado sobre `Pago` + `Credito` + `Cliente`
// + `Producto` + `Usuario`. La capa de datos la maneja Prisma directo
// porque el feature es de solo lectura y no comparte modelo con otros.
//
// Sirve a DOS consumidores con scoping distinto: el staff vía
// `GET /payments/:pagoId/receipt` (`ReceiptsController`) y el cliente vía
// `GET /client-portal/payments/:pagoId/receipt` (`ClientPortalController`,
// que inyecta este mismo service — no duplica la plantilla HTML).
@Injectable()
export class ReceiptsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly receiptToken: ReceiptTokenService,
  ) {}

  // Construye el shape `Receipt` para un pago existente. Lanza 404 si el
  // pago no existe (o si es de otro cliente — ver `assertAccess`) y 403 si
  // es un COBRADOR pidiendo un pago de una ruta ajena.
  async getReceipt(pagoId: string, user: AuthenticatedUser): Promise<Receipt> {
    return this.loadReceipt(pagoId, user);
  }

  // Variante SIN chequeo de rol, para el enlace público firmado (`GET /r/:token`).
  // La autorización ya la hizo `ReceiptTokenService.verify`: el token es la
  // capability. No exponer este método a ningún controller autenticado.
  async getPublicReceipt(pagoId: string): Promise<Receipt> {
    return this.loadReceipt(pagoId, null);
  }

  // `user === null` ⇒ acceso ya autorizado por token firmado.
  private async loadReceipt(pagoId: string, user: AuthenticatedUser | null): Promise<Receipt> {
    const pago = await this.prisma.pago.findUnique({
      where: { id: pagoId },
      include: {
        credito: {
          include: {
            cliente: {
              select: {
                nombre: true,
                telefono: true,
                admins: { select: { adminId: true, ruta: { select: { cobradorId: true } } } },
              },
            },
            producto: { select: { nombre: true } },
            // Todos los pagos del crédito, no solo este: el registro de cuotas
            // y la numeración salen de `buildPaymentHistory`, que necesita el
            // orden cronológico COMPLETO para numerar bien (mismo motivo que
            // documenta `ClosureCreditRow.pagos` en `daily-closure.util.ts`).
            pagos: {
              orderBy: { fecha: "asc" },
              include: { cobrador: { select: { nombre: true } } },
            },
          },
        },
        cobrador: { select: { nombre: true } },
      },
    });
    if (!pago) {
      throw new NotFoundException("Pago no encontrado.");
    }

    if (user) {
      this.assertAccess(pago, user);
    }

    const credito = pago.credito;

    // El saldo restante al momento del pago no se persiste — se deriva del
    // `credito.saldoPendiente` ACTUAL menos los pagos POSTERIORES. Si el
    // crédito ya está saldado y no hay pagos posteriores, `saldoRestante`
    // coincide con `credito.saldoPendiente`.
    const pagosPosteriores = await this.prisma.pago.aggregate({
      where: {
        creditoId: pago.creditoId,
        fecha: { gt: pago.fecha },
      },
      _sum: { monto: true },
    });
    const saldoRestante =
      Number(credito.saldoPendiente.toString()) +
      Number(pagosPosteriores._sum.monto?.toString() ?? "0");

    const progreso = buildReceiptProgress(credito, pago.id);

    return {
      id: pago.id,
      pagoId: pago.id,
      codigo: buildReciboCodigo(pago.id),
      createdAt: pago.createdAt.toISOString(),
      credito: {
        codigo: credito.codigo,
        clienteNombre: credito.cliente.nombre,
        productoNombre: credito.producto.nombre,
        capital: Number(credito.monto.toString()),
        interes: Number(credito.interes.toString()),
        montoTotal: Number(credito.montoTotal.toString()),
        cuotaValor: Number(credito.cuotaDiaria.toString()),
        cuotas: credito.cuotas,
        frecuencia: credito.frecuencia,
      },
      monto: Number(pago.monto.toString()),
      saldoRestante,
      fecha: pago.fecha.toISOString(),
      cobradorNombre: pago.cobrador.nombre,
      ...progreso,
      // El HTML server-rendered no los usa (trae su propio botón "Imprimir" y
      // ya se abre desde el link firmado): calcularlos siempre es más simple
      // que ramificar por consumidor, y firmar un JWT sin I/O es barato.
      reciboPublicUrl: this.receiptToken.buildPublicUrl(pago.id),
      clienteTelefono: pago.credito.cliente.telefono,
      anulado: pago.anulado,
    };
  }

  // Scoping por rol (hallazgo de revisión de Fase 4.0-4.10: antes no existía
  // ningún chequeo, cualquier autenticado veía cualquier recibo):
  // - ADMIN: sin restricción.
  // - COBRADOR: solo recibos de clientes de SU ruta (mismo criterio que
  //   `cobros.service.ts:43` / `creditos.service.ts:61`).
  // - CLIENTE: solo recibos de SUS PROPIOS pagos — 404 genérico (no 403) para
  //   no revelar que el pago existe si es de otro cliente.
  private assertAccess(pago: PagoAccessRow, user: AuthenticatedUser): void {
    // CLIENTE no tiene tenant (se scopea por su propio id) — se resuelve aparte.
    if (user.rol === "CLIENTE") {
      if (pago.credito.clienteId !== user.sub) {
        throw new NotFoundException("Pago no encontrado.");
      }
      return;
    }

    // Staff: primero el tenant. Un recibo de otro admin no existe — 404, no
    // 403, para no confirmar que ese pago existe en otra cartera.
    if (pago.credito.adminId !== requireAdminId(user)) {
      throw new NotFoundException("Pago no encontrado.");
    }

    if (user.rol === "ADMIN") return;

    // La relación cliente↔admin correspondiente a ESTE crédito (el cliente
    // puede tener otras, con otros admins — no sirven acá).
    const relation = pago.credito.cliente.admins.find((a) => a.adminId === pago.credito.adminId);
    if (relation?.ruta?.cobradorId !== user.sub) {
      throw new ForbiddenException("Solo puedes ver recibos de clientes de tus rutas.");
    }
  }
}

// === progreso del crédito AL MOMENTO DEL PAGO ===============================

interface ProgresoCredito {
  numeroCuota: number;
  cuotasPagadas: number;
  cuotasRestantes: number;
  cuotasPagadasDetalle: ReceiptInstallment[];
}

type CreditoConPagos = {
  id: string;
  fechaInicio: Date;
  cuotas: number;
  frecuencia: "DIARIO" | "SEMANAL" | "MENSUAL";
  pagos: {
    id: string;
    creditoId: string;
    monto: { toString(): string };
    fecha: Date;
    cobradorId: string;
    cobrador: { nombre: string | null };
    reciboUrl: string | null;
    anulado: boolean;
  }[];
};

/**
 * Cuántas cuotas llevaba pagadas el crédito CUANDO se hizo este pago, y con
 * qué puntualidad — nunca "a hoy".
 *
 * Un recibo es el comprobante de un instante: el enlace público dura 90 días,
 * así que si se abre tres meses después tiene que seguir diciendo lo mismo que
 * el día que se emitió. Es la misma disciplina que ya usaba `saldoRestante`
 * (que suma de vuelta los pagos posteriores en lugar de leer el saldo actual);
 * calcular esto "a hoy" habría dejado el recibo contradiciéndose solo: "cuota
 * 18 de 20" arriba y el saldo de la cuota 5 abajo.
 *
 * Reusa `buildPaymentHistory` en vez de recontar acá: esa función ya sabe
 * numerar cuotas salteando los pagos anulados y decidir ON_TIME vs LATE, y
 * tiene 35 unit tests. Se corta el historial en este pago y se descarta lo
 * posterior.
 */
function buildReceiptProgress(credito: CreditoConPagos, pagoId: string): ProgresoCredito {
  const historial = buildPaymentHistory(
    credito,
    credito.pagos.map((p) => ({
      id: p.id,
      creditoId: p.creditoId,
      monto: Number(p.monto.toString()),
      fecha: p.fecha,
      cobradorId: p.cobradorId,
      cobradorNombre: p.cobrador.nombre,
      reciboUrl: p.reciboUrl,
      anulado: p.anulado,
    })),
    new Date(),
  );

  // Solo cuotas realmente pagadas: `buildPaymentHistory` también devuelve
  // filas SINTÉTICAS de cuotas sin pagar (`fechaPago === null`) y filas de
  // auditoría de pagos anulados (`numeroCuota === 0`). Ninguna de las dos va
  // en el registro de un recibo.
  const pagadas = historial
    .filter((c) => c.fechaPago !== null && c.numeroCuota > 0 && c.estado !== "ANULADO")
    .sort((a, b) => a.numeroCuota - b.numeroCuota);

  const indice = pagadas.findIndex((c) => c.id === pagoId);

  // El pago no está en el cronograma: es un pago ANULADO (su fila quedó como
  // auditoría con `numeroCuota: 0`). El recibo sigue siendo válido como
  // comprobante — se marca anulado y se muestra sin número de cuota — pero no
  // tiene una posición que reportar, así que no se inventa ninguna.
  if (indice === -1) {
    return { numeroCuota: 0, cuotasPagadas: 0, cuotasRestantes: 0, cuotasPagadasDetalle: [] };
  }

  const hastaEstePago = pagadas.slice(0, indice + 1);
  const cuotasPagadas = hastaEstePago.length;

  return {
    numeroCuota: pagadas[indice]!.numeroCuota,
    cuotasPagadas,
    cuotasRestantes: Math.max(0, credito.cuotas - cuotasPagadas),
    cuotasPagadasDetalle: hastaEstePago.map((c) => ({
      numeroCuota: c.numeroCuota,
      monto: c.monto,
      fechaPago: c.fechaPago!,
      estado: c.estado,
    })),
  };
}

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Prisma, type PrismaClient } from "@prisma/client";
import type { CobroResponse, CreateCobroRequest, CreditoListItem, Pago } from "@repo/types";

import { PrismaService } from "../../core/prisma/prisma.service";
import type { AuthenticatedUser } from "../../core/auth/auth-request";

import { CobrosRepository } from "./cobros.repository";

type Tx = Omit<PrismaClient, "$connect" | "$disconnect">;
type PrismaTx = Prisma.TransactionClient;

@Injectable()
export class CobrosService {
  constructor(
    private readonly cobrosRepository: CobrosRepository,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async registrar(body: CreateCobroRequest, user: AuthenticatedUser): Promise<CobroResponse> {
    // === Validaciones previas (no entran en la transacción) ================
    const monto = new Prisma.Decimal(body.monto);

    const credito = await this.prisma.credito.findUnique({
      where: { id: body.creditoId },
      include: { cliente: { include: { ruta: true } } },
    });
    if (!credito) {
      throw new NotFoundException("El crédito no existe.");
    }

    // Scoping por cobrador: la ruta del cliente del crédito debe ser del
    // cobrador (ADMIN pasa sin chequeo). Un cliente "sin ruta" (§3 — cierre de
    // Fase 3) no tiene cobrador asignado, así que ningún COBRADOR pasa.
    if (user.rol === "COBRADOR" && credito.cliente.ruta?.cobradorId !== user.sub) {
      throw new ForbiddenException("Solo puedes cobrar créditos de clientes de tus rutas.");
    }

    if (credito.estado === "ANULADO") {
      throw new ConflictException("El crédito está anulado.");
    }
    if (credito.estado === "PAGADO") {
      throw new ConflictException("El crédito ya está pagado.");
    }

    const saldoActual = credito.saldoPendiente;
    if (monto.gt(saldoActual)) {
      throw new BadRequestException(
        `El monto (${monto.toFixed(2)}) supera el saldo pendiente (${saldoActual.toFixed(2)}).`,
      );
    }

    // === Transacción atómica =========================================
    // Es la pieza más formativa de la fase: si algo lanza, Postgres revierte
    // las dos escrituras y el cobro no se aplica a medias.
    let result!: CobroResponse;

    try {
      await this.prisma.$transaction(async (txParam) => {
        const tx = txParam as unknown as PrismaTx;

        // 1) descontar saldo (condicional: si el WHERE no afecta, aborta).
        const descuento = await this.cobrosRepository.descontarSaldo({
          tx: tx as unknown as Tx,
          creditoId: body.creditoId,
          monto,
        });
        if (descuento.count === 0) {
          // Carrera perdida (otro cobro simultáneo). El servicio ya validó
          // que el saldo era suficiente — algo cambió en milisegundos.
          throw new ConflictException("El saldo del crédito cambió durante el cobro. Reintenta.");
        }

        // 2) crear el Pago dentro del mismo tx.
        const pago = await this.cobrosRepository.insertarPago(tx as unknown as Tx, {
          creditoId: body.creditoId,
          monto,
          cobradorId: user.sub,
        });

        // 3) si quedó saldado → estado PAGADO.
        const nuevoSaldo = saldoActual.sub(monto);
        if (nuevoSaldo.lte(0)) {
          await tx.credito.update({
            where: { id: body.creditoId },
            data: { estado: "PAGADO" },
          });
        }

        // 4) lectura final para devolver el Crédito recalculado + Pago.
        const creditoFinal = await tx.credito.findUniqueOrThrow({
          where: { id: body.creditoId },
          include: { producto: { select: { nombre: true } } },
        });

        result = {
          pago: toPago(pago),
          credito: toCredito(creditoFinal),
          // Fase 4 — el recibo HTML lo sirve `GET /payments/:pagoId/receipt`
          // (módulo `receipts`). Construimos la URL absoluta con
          // `PUBLIC_APP_URL` para que el front pueda compartir por WhatsApp.
          recibo: buildReciboInfo(this.config.getOrThrow<string>("PUBLIC_APP_URL"), pago.id),
        };
      });
    } catch (error) {
      // Si la validación interna lanza ConflictException, propágala tal cual.
      if (
        error instanceof BadRequestException ||
        error instanceof ConflictException ||
        error instanceof ForbiddenException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      throw error;
    }

    return result;
  }
}

// === toDto: Decimal → number, Date → ISO string (re-parseo vía schema) ======

// Construye la URL y el código del recibo. El código es legible y derivado
// del `pagoId` (los primeros 8 chars en mayúscula). No hay tabla `Recibo`
// separada — la URL es determinística y el back sirve el HTML on-demand en
// `GET /payments/:pagoId/receipt`. Es la URL del BACK (no del front) porque
// el back sirve HTML standalone que el cliente abre desde WhatsApp sin auth.
function buildReciboInfo(publicAppUrl: string, pagoId: string) {
  return {
    url: `${publicAppUrl.replace(/\/$/, "")}/payments/${pagoId}/receipt`,
    codigo: `R-${pagoId.slice(0, 8).toUpperCase()}`,
  };
}

function decimalToNumber(d: Prisma.Decimal): number {
  return Number(d.toString());
}

function toPago(p: {
  id: string;
  creditoId: string;
  monto: Prisma.Decimal;
  fecha: Date;
  cobradorId: string;
  reciboUrl: string | null;
}): Pago {
  return {
    id: p.id,
    creditoId: p.creditoId,
    monto: decimalToNumber(p.monto),
    fecha: p.fecha.toISOString(),
    cobradorId: p.cobradorId,
    reciboUrl: p.reciboUrl ?? null,
  };
}

function toCredito(c: {
  id: string;
  codigo: string;
  clienteId: string;
  monto: Prisma.Decimal;
  interes: Prisma.Decimal;
  dias: number;
  montoTotal: Prisma.Decimal;
  cuotaDiaria: Prisma.Decimal;
  saldoPendiente: Prisma.Decimal;
  estado: "ACTIVO" | "PAGADO" | "MORA" | "ANULADO";
  fechaInicio: Date;
  producto: { nombre: string };
}): CreditoListItem {
  const montoTotal = decimalToNumber(c.montoTotal);
  const saldoPendiente = decimalToNumber(c.saldoPendiente);
  const totalPagado = Number((montoTotal - saldoPendiente).toFixed(2));
  const porcentajePagado =
    montoTotal > 0 ? Number(((totalPagado / montoTotal) * 100).toFixed(2)) : 0;
  const cuotaDiaria = decimalToNumber(c.cuotaDiaria);
  const cuotasTotal = c.dias;
  const cuotasPagadas =
    cuotaDiaria > 0 ? Math.min(c.dias, Math.round(totalPagado / cuotaDiaria)) : 0;

  return {
    id: c.id,
    codigo: c.codigo,
    clienteId: c.clienteId,
    producto: c.producto.nombre,
    monto: decimalToNumber(c.monto),
    interes: decimalToNumber(c.interes),
    dias: c.dias,
    montoTotal,
    cuotaDiaria,
    saldoPendiente,
    totalPagado,
    porcentajePagado,
    estado: c.estado,
    fechaInicio: c.fechaInicio.toISOString(),
    cuotasPagadas,
    cuotasTotal,
  };
}

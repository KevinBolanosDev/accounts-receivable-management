import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Prisma, type PrismaClient } from "@prisma/client";
import type {
  AnularPagoResponse,
  CobroResponse,
  CreateCobroRequest,
  CreditoListItem,
  Pago,
} from "@repo/types";

import { PrismaService } from "../../core/prisma/prisma.service";
import type { AuthenticatedUser } from "../../core/auth/auth-request";
import { requireAdminId } from "../../core/auth/tenant.util";
import {
  mapCreditoListItem,
  type CreditoRowForMapping,
} from "../../core/domain/credito-cliente.util";
import { assertRouteOwnership } from "../../core/domain/route-access.util";
import { buildReciboCodigo } from "../../core/domain/receipt-code.util";
import { ReceiptTokenService } from "../../core/receipts/receipt-token.service";

import { CobrosRepository } from "./cobros.repository";

type Tx = Omit<PrismaClient, "$connect" | "$disconnect">;
type PrismaTx = Prisma.TransactionClient;

@Injectable()
export class CobrosService {
  constructor(
    private readonly cobrosRepository: CobrosRepository,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly receiptToken: ReceiptTokenService,
  ) {}

  async registrar(body: CreateCobroRequest, user: AuthenticatedUser): Promise<CobroResponse> {
    // === Validaciones previas (no entran en la transacción) ================
    const monto = new Prisma.Decimal(body.monto);

    // Scoping por tenant en la propia búsqueda: un crédito de otro admin se
    // reporta como inexistente, así que ni siquiera se llega a la transacción.
    // `Credito.adminId` es explícito (un cliente puede ser cartera de más de
    // un admin, ver `schema.prisma`), así que el filtro va directo ahí.
    const adminId = requireAdminId(user);
    const credito = await this.prisma.credito.findFirst({
      where: { id: body.creditoId, adminId },
      include: {
        cliente: { include: { admins: { where: { adminId }, take: 1, include: { ruta: true } } } },
      },
    });
    if (!credito) {
      throw new NotFoundException("El crédito no existe.");
    }
    const clientRelation = credito.cliente.admins[0];

    // Scoping por cobrador: la ruta del cliente del crédito (en ESTE tenant,
    // ya confirmado por el `findFirst` de arriba) debe ser del cobrador
    // (ADMIN pasa sin chequeo). Un cliente "sin ruta" (§3 — cierre de Fase 3)
    // no tiene cobrador asignado, así que ningún COBRADOR pasa.
    assertRouteOwnership(
      clientRelation?.ruta,
      user,
      "Solo puedes cobrar créditos de clientes de tus rutas.",
    );

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
          // Carrera perdida: el WHERE de `descontarSaldo` no afectó ninguna
          // fila. Dos causas posibles, indistinguibles desde acá a propósito
          // (ver el comentario del repository) — otro cobro simultáneo ya
          // descontó el saldo, o el crédito se anuló/saldó en la ventana
          // entre la validación de arriba y este punto (DATA-1). El servicio
          // ya validó estado y saldo hace un instante — algo cambió en
          // milisegundos.
          throw new ConflictException("El crédito cambió durante el cobro. Reintenta.");
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
          recibo: buildReciboInfo(
            this.config.getOrThrow<string>("PUBLIC_APP_URL"),
            pago.id,
            this.receiptToken.buildPublicUrl(pago.id),
          ),
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

  // Un pago mal registrado se ANULA, nunca se edita: el registro queda (con
  // `anulado: true`, quién y cuándo), su saldo vuelve al crédito, y si ese
  // pago había saldado el crédito (`estado: PAGADO`), se reabre a `ACTIVO`.
  // La corrección es un cobro NUEVO — el mismo `POST /collections` de
  // siempre, sin matemática especial que inventar.
  async anularPago(pagoId: string, user: AuthenticatedUser): Promise<AnularPagoResponse> {
    const adminId = requireAdminId(user);

    // Scoping por tenant en la propia búsqueda, igual que `registrar`: un
    // pago de otro admin se reporta como inexistente.
    const pago = await this.prisma.pago.findFirst({
      where: { id: pagoId, credito: { adminId } },
      include: {
        credito: {
          include: {
            cliente: {
              include: { admins: { where: { adminId }, take: 1, include: { ruta: true } } },
            },
          },
        },
      },
    });
    if (!pago) {
      throw new NotFoundException("El pago no existe.");
    }
    const clientRelation = pago.credito.cliente.admins[0];

    // Mismo criterio de scoping que cobrar: un COBRADOR solo anula pagos de
    // clientes de SUS rutas (ADMIN pasa sin chequeo).
    assertRouteOwnership(
      clientRelation?.ruta,
      user,
      "Solo puedes anular pagos de clientes de tus rutas.",
    );

    if (pago.anulado) {
      throw new ConflictException("Este pago ya fue anulado.");
    }

    let result!: AnularPagoResponse;

    await this.prisma.$transaction(async (txParam) => {
      const tx = txParam as unknown as PrismaTx;

      // 1) marcar el pago como anulado, condicional (control de carrera).
      const anulado = await this.cobrosRepository.anularPago(tx as unknown as Tx, {
        pagoId,
        anuladoPorId: user.sub,
      });
      if (anulado.count === 0) {
        // Alguien más lo anuló entre el chequeo de arriba y este punto.
        throw new ConflictException("Este pago ya fue anulado.");
      }

      // 2) devolver el saldo del crédito; reabrir si este pago lo había saldado.
      const creditoActualizado = await this.cobrosRepository.devolverSaldo(tx as unknown as Tx, {
        creditoId: pago.creditoId,
        monto: pago.monto,
        reabrir: pago.credito.estado === "PAGADO",
      });

      // 3) lectura final del pago (con quién lo anuló) para la respuesta.
      const pagoFinal = await tx.pago.findUniqueOrThrow({
        where: { id: pagoId },
        include: { anuladoPor: { select: { nombre: true } } },
      });

      result = {
        pago: toPago(pagoFinal),
        credito: toCredito(creditoActualizado),
      };
    });

    return result;
  }
}

// === toDto: Decimal → number, Date → ISO string (re-parseo vía schema) ======

// Construye la URL y el código del recibo. El código es legible y derivado
// del `pagoId` (los primeros 8 chars en mayúscula). No hay tabla `Recibo`
// separada — la URL es determinística y el back sirve el HTML on-demand en
// `GET /payments/:pagoId/receipt`. Es la URL del BACK (no del front) porque
// el back sirve HTML standalone que el cliente abre desde WhatsApp sin auth.
function buildReciboInfo(publicAppUrl: string, pagoId: string, publicUrl: string) {
  return {
    // `url` exige JWT de staff — es la que abre el propio cobrador en la app.
    url: `${publicAppUrl.replace(/\/$/, "")}/payments/${pagoId}/receipt`,
    codigo: buildReciboCodigo(pagoId),
    // `publicUrl` va firmada (`/r/:token`) y es la que se manda por WhatsApp:
    // el cliente no tiene JWT de staff y con `url` recibiría un 401.
    publicUrl,
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
  anulado?: boolean;
  anuladoAt?: Date | null;
  anuladoPor?: { nombre: string } | null;
}): Pago {
  return {
    id: p.id,
    creditoId: p.creditoId,
    monto: decimalToNumber(p.monto),
    fecha: p.fecha.toISOString(),
    cobradorId: p.cobradorId,
    reciboUrl: p.reciboUrl ?? null,
    anulado: p.anulado ?? false,
    anuladoAt: p.anuladoAt ? p.anuladoAt.toISOString() : null,
    anuladoPorNombre: p.anuladoPor?.nombre ?? null,
  };
}

// El mapeo vive en `core/domain/credito-cliente.util.ts` (lo comparten cinco
// módulos). Acá había una copia byte a byte del mismo cálculo, que es
// exactamente el tipo de duplicación que se rompe en silencio: con la llegada de
// `frecuencia`/`cuotas`, la copia habría seguido devolviendo `cuotasTotal =
// dias` y el sheet de cobro habría mostrado "cuota 3/28" en un crédito de 4
// cuotas semanales.
function toCredito(c: CreditoRowForMapping): CreditoListItem {
  return mapCreditoListItem(c);
}

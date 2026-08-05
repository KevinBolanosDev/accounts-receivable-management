import { Injectable } from "@nestjs/common";
import { Prisma, PrismaClient } from "@prisma/client";

import { PrismaService } from "../../core/prisma/prisma.service";

// Cobros no necesita una tabla propia extra (`Pago` es la tabla) — el
// repository expone las DOS escrituras que se hacen DENTRO de la
// transacción (`$transaction`): crear el Pago y descontar el saldo del
// Crédito. El service orquesta: usa el cliente Prisma del tx (que es el de
// la `$transaction`) y aplica el descuento de forma **condicional** con
// `updateMany` (concurrencia: si otro cobro ganó la carrera, affected = 0).

type Tx = Omit<PrismaClient, "$connect" | "$disconnect">;

@Injectable()
export class CobrosRepository {
  constructor(_prisma: PrismaService) {}

  /** Crea el `Pago` dentro de la transacción. */
  insertarPago(tx: Tx, data: { creditoId: string; monto: Prisma.Decimal; cobradorId: string }) {
    return tx.pago.create({
      data: {
        creditoId: data.creditoId,
        monto: data.monto,
        cobradorId: data.cobradorId,
      },
    });
  }

  /**
   * Descuenta el saldo de un crédito dentro del tx, **atómicamente**.
   * `where: { id, saldoPendiente: { gte: monto } }` evita el "sobre-descuento"
   * si otro cobro simultáneo ganó la carrera: `affected = 0` y el service
   * aborta con 409 (mapea a `P2025`). Si afecta 1 fila, devolvemos el
   * Crédito ya recalculado para confirmar el nuevo saldo y estado.
   */
  descontarSaldo(args: { tx: Tx; creditoId: string; monto: Prisma.Decimal }) {
    return args.tx.credito.updateMany({
      where: {
        id: args.creditoId,
        saldoPendiente: { gte: args.monto },
      },
      data: {
        // `updateMany` no soporta Decimal dinámico — primero restamos desde
        // la capa service (ya validado contra `saldoActual ≥ monto`). El
        // guard real contra la carrera es la cláusula `saldoPendiente >=
        // monto` del WHERE: si no afecta 0 filas, nadie tocó el saldo.
        saldoPendiente: { decrement: Number(args.monto.toString()) },
      },
    });
  }

  /** Recalcula el estado (PAGADO si saldo llega a 0) tras el descuento. */
  marcarPagadoSiCero(tx: Tx, creditoId: string) {
    return tx.credito.update({
      where: { id: creditoId },
      data: { estado: "PAGADO" },
    });
  }

  /**
   * Marca el `Pago` como anulado dentro del tx, **condicional**
   * (`anulado: false` en el WHERE): mismo patrón que `descontarSaldo` — si
   * `affected = 0`, alguien más ya lo anuló entre el chequeo del service y
   * este punto, y el caller debe abortar con 409 en vez de anularlo dos veces.
   */
  anularPago(tx: Tx, args: { pagoId: string; anuladoPorId: string }) {
    return tx.pago.updateMany({
      where: { id: args.pagoId, anulado: false },
      data: { anulado: true, anuladoAt: new Date(), anuladoPorId: args.anuladoPorId },
    });
  }

  /**
   * Devuelve al saldo del crédito lo que ese pago había descontado, y si el
   * crédito se había cerrado como PAGADO por ESE pago, lo reabre a ACTIVO.
   * Nunca puede pasarse de `montoTotal`: solo se devuelve lo que un
   * `descontarSaldo` anterior efectivamente restó.
   */
  devolverSaldo(tx: Tx, args: { creditoId: string; monto: Prisma.Decimal; reabrir: boolean }) {
    return tx.credito.update({
      where: { id: args.creditoId },
      data: {
        saldoPendiente: { increment: Number(args.monto.toString()) },
        estado: args.reabrir ? "ACTIVO" : undefined,
      },
      include: { producto: { select: { id: true, nombre: true } } },
    });
  }

  /** Lectura del Crédito dentro del tx (para devolverlo recalculado). */
  findCreditoEnTx(tx: Tx, creditoId: string) {
    return tx.credito.findUnique({
      where: { id: creditoId },
      include: { producto: { select: { id: true, nombre: true } } },
    });
  }
}

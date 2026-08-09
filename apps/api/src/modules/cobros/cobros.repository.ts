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
   * `where: { id, saldoPendiente: { gte: monto }, estado: { in: [...] } }`
   * evita DOS carreras a la vez, no solo el "sobre-descuento":
   *
   * 1. Otro cobro simultáneo ya descontó saldo (la cláusula `saldoPendiente`).
   * 2. El crédito se ANULÓ (o quedó PAGADO por otro cobro) en la ventana
   *    entre la lectura de `estado` del service (antes de abrir la
   *    transacción) y este UPDATE. Antes del hardening de Fase 6 (DATA-1),
   *    el `estado` NO estaba en este WHERE: un cobro podía descontar saldo
   *    de un crédito recién anulado si `anular()` (creditos.service.ts)
   *    committeaba justo en esa ventana — el pre-check del service ya no
   *    alcanza a bloquearlo porque leyó el estado viejo. Postgres serializa
   *    los dos UPDATE por fila (row lock): el segundo en llegar reevalúa este
   *    WHERE contra el estado YA actualizado por el primero, así que ahora es
   *    imposible que ambos "ganen".
   *
   * Si `count === 0`, el service aborta con 409 (carrera perdida, cualquiera
   * de las dos razones). Si afecta 1 fila, devolvemos el Crédito ya
   * recalculado para confirmar el nuevo saldo y estado.
   */
  descontarSaldo(args: { tx: Tx; creditoId: string; monto: Prisma.Decimal }) {
    return args.tx.credito.updateMany({
      where: {
        id: args.creditoId,
        saldoPendiente: { gte: args.monto },
        estado: { in: ["ACTIVO", "MORA"] },
      },
      data: {
        // `updateMany` no soporta Decimal dinámico — primero restamos desde
        // la capa service (ya validado contra `saldoActual ≥ monto`). El
        // guard real contra la carrera es el WHERE completo de arriba: si no
        // afecta filas, nadie ganó nada de más.
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

import {
  computeClosureSummary,
  isRouteClosedOn,
  type ClosureCreditRow,
} from "./daily-closure.util";

// Mismo ancla que usan las pruebas de `payment-schedule.util`, pero a las
// 17:00 UTC (mediodía en `America/Bogota`, UTC-5): lejos de cualquier límite
// de día tanto en UTC (lo que usa `buildPaymentHistory` internamente) como en
// hora local de Bogotá (lo que usa `dayRange`), así que un mismo `dia(n)`
// representa "el día n" sin ambigüedad para los dos sistemas a la vez.
function dia(offset: number): Date {
  return new Date(Date.UTC(2026, 0, 1 + offset, 17, 0, 0));
}

function pago(
  overrides: Partial<ClosureCreditRow["pagos"][number]> = {},
): ClosureCreditRow["pagos"][number] {
  return {
    id: `pg-${Math.random()}`,
    creditoId: "cr-x",
    monto: 20_000,
    fecha: dia(0),
    cobradorId: "u-1",
    cobradorNombre: "Cobrador Demo",
    reciboUrl: null,
    anulado: false,
    ...overrides,
  };
}

function credito(overrides: Partial<ClosureCreditRow> = {}): ClosureCreditRow {
  return {
    id: "cr-1",
    clienteId: "cl-1",
    clienteNombre: "Cliente Demo",
    clienteTelefono: "+573001234567",
    estado: "ACTIVO",
    fechaInicio: dia(-1),
    cuotas: 30,
    frecuencia: "DIARIO",
    montoTotal: 600_000,
    saldoPendiente: 580_000,
    pagos: [],
    ...overrides,
  };
}

describe("computeClosureSummary", () => {
  it("día con todos pagando: unpaidClients y creditosEnMora vacíos", () => {
    // fechaInicio = dia(-1) ⇒ la cuota 1 vence HOY (dia(0)); se paga hoy.
    const creditoA = credito({
      id: "cr-a",
      clienteId: "cl-a",
      clienteNombre: "Ana",
      pagos: [pago({ id: "pg-a", creditoId: "cr-a", fecha: dia(0), monto: 20_000 })],
    });
    const creditoB = credito({
      id: "cr-b",
      clienteId: "cl-b",
      clienteNombre: "Beto",
      pagos: [pago({ id: "pg-b", creditoId: "cr-b", fecha: dia(0), monto: 20_000 })],
    });

    const resumen = computeClosureSummary({ creditos: [creditoA, creditoB], date: dia(0) });

    expect(resumen.unpaidClients).toHaveLength(0);
    expect(resumen.creditosEnMora).toHaveLength(0);
  });

  it("crédito con cuota vencida hace 7+ días sin pago: aparece en creditosEnMora", () => {
    // fechaInicio = dia(-8) ⇒ cuota 1 vence dia(-7); a dia(0) lleva 7 días de
    // atraso ⇒ DEFAULTED (mismo umbral que `payment-schedule.util`).
    const creditoMora = credito({
      id: "cr-mora",
      clienteId: "cl-mora",
      clienteNombre: "Clara",
      fechaInicio: dia(-8),
      pagos: [],
    });

    const resumen = computeClosureSummary({ creditos: [creditoMora], date: dia(0) });

    expect(resumen.creditosEnMora).toEqual(["cr-mora"]);
    expect(resumen.unpaidClients).toEqual([
      { clienteId: "cl-mora", nombre: "Clara", saldoPendiente: 580_000, telefono: "+573001234567" },
    ]);
  });

  it("una cuota vencida hace menos de 7 días (OVERDUE) todavía NO es mora", () => {
    // fechaInicio = dia(-3) ⇒ cuota 1 vence dia(-2); a dia(0) son 2 días de
    // atraso ⇒ OVERDUE, no DEFAULTED.
    const creditoVencido = credito({ id: "cr-overdue", fechaInicio: dia(-3), pagos: [] });

    const resumen = computeClosureSummary({ creditos: [creditoVencido], date: dia(0) });

    expect(resumen.creditosEnMora).toHaveLength(0);
    // Sigue sin pagar hoy, así que sí entra en la lista de sin pagar.
    expect(resumen.unpaidClients).toHaveLength(1);
  });

  it("totalCollected/collectedCount suman solo los pagos del rango del día", () => {
    const c = credito({
      id: "cr-c",
      fechaInicio: dia(-5),
      pagos: [
        pago({ id: "pg-ayer", creditoId: "cr-c", fecha: dia(-1), monto: 20_000 }),
        pago({ id: "pg-hoy", creditoId: "cr-c", fecha: dia(0), monto: 25_000 }),
      ],
    });

    const resumen = computeClosureSummary({ creditos: [c], date: dia(0) });

    expect(resumen.totalCollected).toBe(25_000);
    expect(resumen.collectedCount).toBe(1);
  });

  it("un pago anulado no cuenta para los totales del día", () => {
    const c = credito({
      id: "cr-anulado-pago",
      fechaInicio: dia(-1),
      pagos: [
        pago({
          id: "pg-anulado",
          creditoId: "cr-anulado-pago",
          fecha: dia(0),
          monto: 20_000,
          anulado: true,
        }),
      ],
    });

    const resumen = computeClosureSummary({ creditos: [c], date: dia(0) });

    expect(resumen.totalCollected).toBe(0);
    expect(resumen.collectedCount).toBe(0);
    // Sin pago vigente hoy, el cliente sigue apareciendo como sin pagar.
    expect(resumen.unpaidClients).toHaveLength(1);
  });

  it("un crédito PAGADO nunca entra en mora aunque su cronograma esté vencido", () => {
    const creditoPagado = credito({
      id: "cr-pagado",
      estado: "PAGADO",
      fechaInicio: dia(-30),
      saldoPendiente: 0,
      pagos: [],
    });

    const resumen = computeClosureSummary({ creditos: [creditoPagado], date: dia(0) });

    expect(resumen.creditosEnMora).toHaveLength(0);
    // Tampoco es "cliente sin pagar": ya no tiene crédito activo.
    expect(resumen.unpaidClients).toHaveLength(0);
  });

  it("un crédito ANULADO nunca entra en mora ni en sin pagar", () => {
    const creditoAnulado = credito({
      id: "cr-anulado",
      estado: "ANULADO",
      fechaInicio: dia(-30),
      pagos: [],
    });

    const resumen = computeClosureSummary({ creditos: [creditoAnulado], date: dia(0) });

    expect(resumen.creditosEnMora).toHaveLength(0);
    expect(resumen.unpaidClients).toHaveLength(0);
  });

  it("newCredits/newCreditsAmount cuentan solo los créditos otorgados hoy", () => {
    const nuevo = credito({ id: "cr-nuevo", fechaInicio: dia(0), montoTotal: 600_000 });
    const viejo = credito({
      id: "cr-viejo",
      clienteId: "cl-viejo",
      fechaInicio: dia(-5),
      montoTotal: 900_000,
    });

    const resumen = computeClosureSummary({ creditos: [nuevo, viejo], date: dia(0) });

    expect(resumen.newCredits).toBe(1);
    expect(resumen.newCreditsAmount).toBe(600_000);
    // 1 Credito = 1 Producto: coincide siempre con newCredits.
    expect(resumen.productsSold).toBe(resumen.newCredits);
  });

  it("un cliente con dos créditos activos y ninguno pagado hoy suma el saldo de ambos en una sola fila", () => {
    const credito1 = credito({
      id: "cr-multi-1",
      clienteId: "cl-multi",
      clienteNombre: "Multi Cliente",
      saldoPendiente: 100_000,
      fechaInicio: dia(-5),
      pagos: [],
    });
    const credito2 = credito({
      id: "cr-multi-2",
      clienteId: "cl-multi",
      clienteNombre: "Multi Cliente",
      saldoPendiente: 250_000,
      fechaInicio: dia(-5),
      pagos: [],
    });

    const resumen = computeClosureSummary({ creditos: [credito1, credito2], date: dia(0) });

    expect(resumen.unpaidClients).toEqual([
      {
        clienteId: "cl-multi",
        nombre: "Multi Cliente",
        saldoPendiente: 350_000,
        telefono: "+573001234567",
      },
    ]);
  });

  it("un cliente con dos créditos activos que pagó en UNO de ellos no aparece como sin pagar", () => {
    const credito1 = credito({
      id: "cr-pago-parcial-1",
      clienteId: "cl-parcial",
      saldoPendiente: 100_000,
      fechaInicio: dia(-5),
      pagos: [pago({ id: "pg-parcial", creditoId: "cr-pago-parcial-1", fecha: dia(0) })],
    });
    const credito2 = credito({
      id: "cr-pago-parcial-2",
      clienteId: "cl-parcial",
      saldoPendiente: 250_000,
      fechaInicio: dia(-5),
      pagos: [],
    });

    const resumen = computeClosureSummary({ creditos: [credito1, credito2], date: dia(0) });

    expect(resumen.unpaidClients).toHaveLength(0);
  });
});

describe("isRouteClosedOn", () => {
  const BOGOTA = "America/Bogota";

  it("true si ya existe un cierre para el mismo día local", () => {
    // Cierre guardado tal como lo persistiría el service: medianoche UTC del
    // día calendario (así devuelve Prisma un `@db.Date`).
    const cierres = [{ date: new Date("2026-08-05T00:00:00.000Z") }];
    expect(isRouteClosedOn(cierres, new Date("2026-08-05T20:00:00.000Z"), BOGOTA)).toBe(true);
  });

  it("false si el cierre es de otro día", () => {
    const cierres = [{ date: new Date("2026-08-04T00:00:00.000Z") }];
    expect(isRouteClosedOn(cierres, new Date("2026-08-05T20:00:00.000Z"), BOGOTA)).toBe(false);
  });

  it("false sin cierres", () => {
    expect(isRouteClosedOn([], new Date("2026-08-05T20:00:00.000Z"), BOGOTA)).toBe(false);
  });

  it("un pago a las 23:30 local sigue perteneciendo al día en que se hizo, no al siguiente", () => {
    // 23:30 del 5 de agosto en Bogotá = 04:30 UTC del 6.
    const tardeEnLaNoche = new Date("2026-08-06T04:30:00.000Z");
    const cierreDelCinco = [{ date: new Date("2026-08-05T00:00:00.000Z") }];
    expect(isRouteClosedOn(cierreDelCinco, tardeEnLaNoche, BOGOTA)).toBe(true);
  });
});

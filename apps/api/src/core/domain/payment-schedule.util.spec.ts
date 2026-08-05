import {
  buildPaymentHistory,
  computeProximaFechaCuota,
  cuotasVencidasAlDia,
  fechaVencimientoCuota,
  parseFechaInicio,
} from "./payment-schedule.util";

function dia(offset: number): Date {
  return new Date(Date.UTC(2026, 0, 1 + offset));
}

// Regla del cronograma: el día del desembolso NO se cobra. La cuota 1 vence un
// período después de `fechaInicio` — al día siguiente en diario, a los 7 días en
// semanal, el mismo día del mes siguiente en mensual.
describe("fechaVencimientoCuota", () => {
  it("diario: la cuota 1 vence al día siguiente del desembolso", () => {
    expect(fechaVencimientoCuota(dia(0), 1, "DIARIO").toISOString()).toBe(dia(1).toISOString());
    expect(fechaVencimientoCuota(dia(0), 2, "DIARIO").toISOString()).toBe(dia(2).toISOString());
  });

  it("semanal: la cuota 1 vence 7 días después del desembolso", () => {
    expect(fechaVencimientoCuota(dia(0), 1, "SEMANAL").toISOString()).toBe(dia(7).toISOString());
    expect(fechaVencimientoCuota(dia(0), 3, "SEMANAL").toISOString()).toBe(dia(21).toISOString());
  });

  it("mensual: la cuota 1 vence el mismo día del mes siguiente", () => {
    const inicio = new Date(Date.UTC(2026, 0, 15)); // 15 ene
    expect(fechaVencimientoCuota(inicio, 1, "MENSUAL").toISOString()).toBe(
      new Date(Date.UTC(2026, 1, 15)).toISOString(),
    );
    expect(fechaVencimientoCuota(inicio, 3, "MENSUAL").toISOString()).toBe(
      new Date(Date.UTC(2026, 3, 15)).toISOString(),
    );
  });

  it("mensual: un día que no existe en el mes destino cae al último día del mes", () => {
    const inicio = new Date(Date.UTC(2026, 0, 31)); // 31 ene
    // Febrero 2026 tiene 28 días: la cuota 1 vence el 28, no el 3 de marzo.
    expect(fechaVencimientoCuota(inicio, 1, "MENSUAL").toISOString()).toBe(
      new Date(Date.UTC(2026, 1, 28)).toISOString(),
    );
    // Y la cuota 2 vuelve al 31, porque marzo sí lo tiene (no se arrastra el 28).
    expect(fechaVencimientoCuota(inicio, 2, "MENSUAL").toISOString()).toBe(
      new Date(Date.UTC(2026, 2, 31)).toISOString(),
    );
  });

  it("mensual: preserva la hora del día del inicio", () => {
    const inicio = new Date(Date.UTC(2026, 0, 10, 14, 30));
    expect(fechaVencimientoCuota(inicio, 1, "MENSUAL").toISOString()).toBe(
      new Date(Date.UTC(2026, 1, 10, 14, 30)).toISOString(),
    );
  });
});

describe("parseFechaInicio", () => {
  // Un `<input type="date">` manda "YYYY-MM-DD" y `new Date(...)` lo lee como
  // medianoche UTC, que en America/Bogota (UTC-5) es el día ANTERIOR: el crédito
  // quedaba con todo su cronograma corrido un día hacia atrás.
  it("ancla una fecha sin hora al mediodía UTC del día elegido", () => {
    expect(parseFechaInicio("2026-07-29").toISOString()).toBe("2026-07-29T12:00:00.000Z");
  });

  it("el día de calendario sobrevive al formateo en America/Bogota", () => {
    const fecha = parseFechaInicio("2026-07-29");
    const enBogota = new Intl.DateTimeFormat("es-CO", {
      timeZone: "America/Bogota",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(fecha);
    expect(enBogota).toBe("29/07/2026");
  });

  it("respeta un timestamp completo tal cual", () => {
    expect(parseFechaInicio("2026-07-29T18:45:00.000Z").toISOString()).toBe(
      "2026-07-29T18:45:00.000Z",
    );
  });
});

describe("buildPaymentHistory", () => {
  const credito = { id: "cr-1", fechaInicio: dia(0), cuotas: 30, frecuencia: "DIARIO" as const };

  it("marca ON_TIME un pago registrado el día que vence la cuota", () => {
    const pagos = [
      {
        id: "pg-1",
        creditoId: "cr-1",
        monto: 55_000,
        // La cuota 1 vence el día 1 (el día 0 fue el desembolso).
        fecha: dia(1),
        cobradorId: "u-1",
        cobradorNombre: "Cobrador Demo",
        reciboUrl: null,
      },
    ];
    const historial = buildPaymentHistory(credito, pagos, dia(1));
    const fila = historial.find((h) => h.id === "pg-1")!;
    expect(fila.numeroCuota).toBe(1);
    expect(fila.estado).toBe("ON_TIME");
    expect(fila.diasAtraso).toBe(0);
    expect(fila.fechaVencimiento).toBe(dia(1).toISOString());
    expect(fila.fechaPago).toBe(dia(1).toISOString());
  });

  it("un pago adelantado (el mismo día del desembolso) también es ON_TIME", () => {
    const pagos = [
      {
        id: "pg-1",
        creditoId: "cr-1",
        monto: 55_000,
        fecha: dia(0),
        cobradorId: "u-1",
        cobradorNombre: null,
        reciboUrl: null,
      },
    ];
    const historial = buildPaymentHistory(credito, pagos, dia(0));
    const fila = historial.find((h) => h.id === "pg-1")!;
    expect(fila.estado).toBe("ON_TIME");
    expect(fila.diasAtraso).toBe(0);
    // Vencía al día siguiente, aunque se haya pagado antes.
    expect(fila.fechaVencimiento).toBe(dia(1).toISOString());
  });

  it("marca LATE un pago registrado después del día esperado", () => {
    const pagos = [
      {
        id: "pg-1",
        creditoId: "cr-1",
        monto: 55_000,
        // cuota 1 esperada el día 1; se pagó el día 3.
        fecha: dia(3),
        cobradorId: "u-1",
        cobradorNombre: "Cobrador Demo",
        reciboUrl: null,
      },
    ];
    const historial = buildPaymentHistory(credito, pagos, dia(3));
    const fila = historial.find((h) => h.id === "pg-1")!;
    expect(fila.estado).toBe("LATE");
    expect(fila.diasAtraso).toBe(2);
    // El caso que motivó separar las dos columnas: vencía el día 1 pero se
    // pagó el día 3, y antes la tabla mostraba una sola fecha sin decir cuál.
    expect(fila.fechaVencimiento).toBe(dia(1).toISOString());
    expect(fila.fechaPago).toBe(dia(3).toISOString());
  });

  it("el día del desembolso no genera ninguna cuota (todavía no se cobra)", () => {
    expect(buildPaymentHistory(credito, [], dia(0))).toHaveLength(0);
  });

  it("agrega filas sintéticas sin pagar por cada período vencido sin pago", () => {
    // Día 3: vencieron las cuotas 1, 2 y 3 (la del día 0 no existe).
    const historial = buildPaymentHistory(credito, [], dia(3));
    expect(historial).toHaveLength(3);
    expect(historial.every((h) => h.monto === 0 && h.reciboCodigo === null)).toBe(true);
    // Sin pagar ⇒ sin fecha de pago. Es lo que distingue la fila de una pagada.
    expect(historial.every((h) => h.fechaPago === null)).toBe(true);
    // Orden: cuota más reciente primero.
    expect(historial[0]!.numeroCuota).toBe(3);
  });

  // Escalada por tiempo de una cuota sin pagar.
  it("la cuota que vence HOY queda PENDING (todavía se puede cobrar)", () => {
    const historial = buildPaymentHistory(credito, [], dia(1));
    expect(historial).toHaveLength(1);
    expect(historial[0]!.estado).toBe("PENDING");
    expect(historial[0]!.diasAtraso).toBe(0);
  });

  it("pasa a OVERDUE al día siguiente de vencer", () => {
    const historial = buildPaymentHistory(credito, [], dia(2));
    const cuota1 = historial.find((h) => h.numeroCuota === 1)!;
    expect(cuota1.estado).toBe("OVERDUE");
    expect(cuota1.diasAtraso).toBe(1);
    // La del día en curso sigue siendo PENDING.
    expect(historial.find((h) => h.numeroCuota === 2)!.estado).toBe("PENDING");
  });

  it("sigue OVERDUE hasta el día 6 de atraso", () => {
    const historial = buildPaymentHistory(credito, [], dia(7));
    const cuota1 = historial.find((h) => h.numeroCuota === 1)!;
    expect(cuota1.diasAtraso).toBe(6);
    expect(cuota1.estado).toBe("OVERDUE");
  });

  it("pasa a DEFAULTED (mora) a los 7 días de atraso", () => {
    const historial = buildPaymentHistory(credito, [], dia(8));
    const cuota1 = historial.find((h) => h.numeroCuota === 1)!;
    expect(cuota1.diasAtraso).toBe(7);
    expect(cuota1.estado).toBe("DEFAULTED");
  });

  it("no genera cuotas sin pagar más allá de `cuotas` (tope del plan)", () => {
    const creditoCorto = {
      id: "cr-2",
      fechaInicio: dia(0),
      cuotas: 2,
      frecuencia: "DIARIO" as const,
    };
    const historial = buildPaymentHistory(creditoCorto, [], dia(10));
    expect(historial).toHaveLength(2);
  });

  // === Frecuencia semanal ==================================================

  const creditoSemanal = {
    id: "cr-sem",
    fechaInicio: dia(0),
    cuotas: 4,
    frecuencia: "SEMANAL" as const,
  };

  it("semanal: durante la primera semana no hay ninguna cuota vencida", () => {
    // Día 6: la cuota 1 vence el día 7, así que todavía no aparece nada.
    expect(buildPaymentHistory(creditoSemanal, [], dia(6))).toHaveLength(0);
  });

  it("semanal: la cuota 1 vence a los 7 días y entra como PENDING", () => {
    const historial = buildPaymentHistory(creditoSemanal, [], dia(7));
    expect(historial).toHaveLength(1);
    const cuota1 = historial[0]!;
    expect(cuota1.numeroCuota).toBe(1);
    expect(cuota1.fechaVencimiento).toBe(dia(7).toISOString());
    expect(cuota1.estado).toBe("PENDING");
  });

  it("semanal: un pago hecho 3 días después de vencer la cuota queda LATE", () => {
    const pagos = [
      {
        id: "pg-1",
        creditoId: "cr-sem",
        monto: 300_000,
        fecha: dia(10),
        cobradorId: "u-1",
        cobradorNombre: null,
        reciboUrl: null,
      },
    ];
    const historial = buildPaymentHistory(creditoSemanal, pagos, dia(10));
    const fila = historial.find((h) => h.id === "pg-1")!;
    expect(fila.estado).toBe("LATE");
    expect(fila.diasAtraso).toBe(3);
  });

  // === Frecuencia mensual ==================================================

  it("mensual: a los 40 días hay 1 cuota vencida, no 40", () => {
    const creditoMensual = {
      id: "cr-mes",
      fechaInicio: new Date(Date.UTC(2026, 0, 10)),
      cuotas: 6,
      frecuencia: "MENSUAL" as const,
    };
    // 19 de feb: venció la cuota 1 (10 de feb); la 2 vence el 10 de marzo.
    const historial = buildPaymentHistory(creditoMensual, [], new Date(Date.UTC(2026, 1, 19)));
    expect(historial).toHaveLength(1);
    // Venció hace 9 días: mora (el umbral es 7 días para las tres frecuencias).
    expect(historial[0]!.estado).toBe("DEFAULTED");
    expect(historial[0]!.diasAtraso).toBe(9);
  });

  // === Pagos anulados ("Anular pago" — corrección de un cobro mal
  // registrado, nunca una edición) ==========================================

  it("un pago anulado no cuenta como cuota pagada: el período vuelve a verse pendiente", () => {
    const pagos = [
      {
        id: "pg-1",
        creditoId: "cr-1",
        monto: 55_000,
        fecha: dia(1),
        cobradorId: "u-1",
        cobradorNombre: "Cobrador Demo",
        reciboUrl: null,
        anulado: true,
      },
    ];
    // Día 1: si el pago contara, la cuota 1 estaría pagada y no habría
    // ninguna fila pendiente. Anulado, la cuota 1 vuelve a estar PENDING.
    const historial = buildPaymentHistory(credito, pagos, dia(1));
    const pendiente = historial.find((h) => h.numeroCuota === 1)!;
    expect(pendiente.estado).toBe("PENDING");
    expect(pendiente.fechaPago).toBeNull();
  });

  it("el pago anulado aparece como fila de auditoría con numeroCuota 0 y estado ANULADO", () => {
    const pagos = [
      {
        id: "pg-1",
        creditoId: "cr-1",
        monto: 55_000,
        fecha: dia(1),
        cobradorId: "u-1",
        cobradorNombre: "Cobrador Demo",
        reciboUrl: null,
        anulado: true,
      },
    ];
    const historial = buildPaymentHistory(credito, pagos, dia(1));
    const anulado = historial.find((h) => h.id === "pg-1")!;
    expect(anulado.estado).toBe("ANULADO");
    expect(anulado.numeroCuota).toBe(0);
    expect(anulado.monto).toBe(55_000); // el monto se conserva — es auditoría, no se oculta.
  });

  it("no deja un hueco en la numeración: el siguiente pago vigente sigue siendo la cuota 1", () => {
    const pagos = [
      {
        id: "pg-anulado",
        creditoId: "cr-1",
        monto: 55_000,
        fecha: dia(1),
        cobradorId: "u-1",
        cobradorNombre: "Cobrador Demo",
        reciboUrl: null,
        anulado: true,
      },
      {
        id: "pg-correcto",
        creditoId: "cr-1",
        monto: 55_000,
        fecha: dia(1),
        cobradorId: "u-1",
        cobradorNombre: "Cobrador Demo",
        reciboUrl: null,
        anulado: false,
      },
    ];
    const historial = buildPaymentHistory(credito, pagos, dia(1));
    const correcto = historial.find((h) => h.id === "pg-correcto")!;
    // Sin el anulado en el medio, el pago correcto sigue siendo la cuota 1 —
    // no la 2, que sería el caso si el anulado ocupara un lugar en la cuenta.
    expect(correcto.numeroCuota).toBe(1);
    expect(correcto.estado).toBe("ON_TIME");
  });
});

describe("cuotasVencidasAlDia", () => {
  it("no cuenta ninguna el día del desembolso", () => {
    const credito = { id: "cr-1", fechaInicio: dia(0), cuotas: 10, frecuencia: "DIARIO" as const };
    expect(cuotasVencidasAlDia(credito, dia(0))).toBe(0);
    expect(cuotasVencidasAlDia(credito, dia(1))).toBe(1);
    expect(cuotasVencidasAlDia(credito, dia(4))).toBe(4);
  });

  it("topea en el total de cuotas del plan", () => {
    const credito = { id: "cr-1", fechaInicio: dia(0), cuotas: 3, frecuencia: "DIARIO" as const };
    expect(cuotasVencidasAlDia(credito, dia(90))).toBe(3);
  });

  it("semanal: avanza una cuota cada 7 días", () => {
    const credito = { id: "cr-1", fechaInicio: dia(0), cuotas: 8, frecuencia: "SEMANAL" as const };
    expect(cuotasVencidasAlDia(credito, dia(6))).toBe(0);
    expect(cuotasVencidasAlDia(credito, dia(7))).toBe(1);
    expect(cuotasVencidasAlDia(credito, dia(21))).toBe(3);
  });
});

describe("computeProximaFechaCuota", () => {
  it("sin pagos, la próxima cuota es un período después del desembolso", () => {
    const proxima = computeProximaFechaCuota({
      fechaInicio: dia(0),
      cuotas: 30,
      frecuencia: "DIARIO",
      cuotasPagadas: 0,
      estado: "ACTIVO",
    });
    expect(proxima).toBe(dia(1).toISOString());
  });

  it("devuelve la fecha siguiente a las cuotas ya pagadas", () => {
    const proxima = computeProximaFechaCuota({
      fechaInicio: dia(0),
      cuotas: 30,
      frecuencia: "DIARIO",
      cuotasPagadas: 12,
      estado: "ACTIVO",
    });
    expect(proxima).toBe(dia(13).toISOString());
  });

  it("semanal: la próxima cuota cae una semana después de la última pagada", () => {
    const proxima = computeProximaFechaCuota({
      fechaInicio: dia(0),
      cuotas: 8,
      frecuencia: "SEMANAL",
      cuotasPagadas: 2,
      estado: "ACTIVO",
    });
    expect(proxima).toBe(dia(21).toISOString());
  });

  it("mensual: la próxima cuota cae el mismo día del mes siguiente", () => {
    const proxima = computeProximaFechaCuota({
      fechaInicio: new Date(Date.UTC(2026, 0, 20)),
      cuotas: 6,
      frecuencia: "MENSUAL",
      cuotasPagadas: 1,
      estado: "ACTIVO",
    });
    expect(proxima).toBe(new Date(Date.UTC(2026, 2, 20)).toISOString());
  });

  it("devuelve null si el crédito está PAGADO", () => {
    const proxima = computeProximaFechaCuota({
      fechaInicio: dia(0),
      cuotas: 30,
      frecuencia: "DIARIO",
      cuotasPagadas: 30,
      estado: "PAGADO",
    });
    expect(proxima).toBeNull();
  });

  it("devuelve null si el crédito está ANULADO", () => {
    const proxima = computeProximaFechaCuota({
      fechaInicio: dia(0),
      cuotas: 30,
      frecuencia: "DIARIO",
      cuotasPagadas: 5,
      estado: "ANULADO",
    });
    expect(proxima).toBeNull();
  });

  it("devuelve null si ya se pagaron todas las cuotas (crédito ACTIVO por error de rollup)", () => {
    const proxima = computeProximaFechaCuota({
      fechaInicio: dia(0),
      cuotas: 30,
      frecuencia: "DIARIO",
      cuotasPagadas: 30,
      estado: "ACTIVO",
    });
    expect(proxima).toBeNull();
  });
});

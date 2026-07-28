import { buildPaymentHistory, computeProximaFechaCuota } from "./payment-schedule.util";

const DIA_MS = 24 * 60 * 60 * 1000;

function dia(offset: number): Date {
  return new Date(Date.UTC(2026, 0, 1 + offset));
}

describe("buildPaymentHistory", () => {
  const credito = { id: "cr-1", fechaInicio: dia(0), dias: 30 };

  it("marca ON_TIME un pago registrado el mismo día esperado", () => {
    const pagos = [
      {
        id: "pg-1",
        creditoId: "cr-1",
        monto: 55_000,
        fecha: dia(0),
        cobradorId: "u-1",
        cobradorNombre: "Cobrador Demo",
        reciboUrl: null,
      },
    ];
    const historial = buildPaymentHistory(credito, pagos, dia(0));
    const fila = historial.find((h) => h.id === "pg-1")!;
    expect(fila.numeroCuota).toBe(1);
    expect(fila.estado).toBe("ON_TIME");
    expect(fila.diasAtraso).toBe(0);
    // Las dos fechas coinciden porque se pagó el día que vencía; lo que importa
    // es que ambas vengan pobladas y por separado.
    expect(fila.fechaVencimiento).toBe(dia(0).toISOString());
    expect(fila.fechaPago).toBe(dia(0).toISOString());
  });

  it("marca LATE un pago registrado después del día esperado", () => {
    const pagos = [
      {
        id: "pg-1",
        creditoId: "cr-1",
        monto: 55_000,
        // cuota 1 esperada el día 0; se pagó el día 2.
        fecha: dia(2),
        cobradorId: "u-1",
        cobradorNombre: "Cobrador Demo",
        reciboUrl: null,
      },
    ];
    const historial = buildPaymentHistory(credito, pagos, dia(2));
    const fila = historial.find((h) => h.id === "pg-1")!;
    expect(fila.estado).toBe("LATE");
    expect(fila.diasAtraso).toBe(2);
    // El caso que motivó separar las dos columnas: vencía el día 0 pero se
    // pagó el día 2, y antes la tabla mostraba una sola fecha sin decir cuál.
    expect(fila.fechaVencimiento).toBe(dia(0).toISOString());
    expect(fila.fechaPago).toBe(dia(2).toISOString());
  });

  it("agrega filas sintéticas sin pagar para días transcurridos sin pago", () => {
    // Sin pagos registrados, 3 días transcurridos desde fechaInicio.
    const historial = buildPaymentHistory(credito, [], dia(2));
    expect(historial).toHaveLength(3);
    expect(historial.every((h) => h.monto === 0 && h.reciboCodigo === null)).toBe(true);
    // Sin pagar ⇒ sin fecha de pago. Es lo que distingue la fila de una pagada.
    expect(historial.every((h) => h.fechaPago === null)).toBe(true);
    // Orden: cuota más reciente primero.
    expect(historial[0]!.numeroCuota).toBe(3);
  });

  // Escalada por tiempo de una cuota sin pagar.
  it("la cuota que vence HOY queda PENDING (todavía se puede cobrar)", () => {
    const historial = buildPaymentHistory(credito, [], dia(0));
    expect(historial).toHaveLength(1);
    expect(historial[0]!.estado).toBe("PENDING");
    expect(historial[0]!.diasAtraso).toBe(0);
  });

  it("pasa a OVERDUE al día siguiente de vencer", () => {
    const historial = buildPaymentHistory(credito, [], dia(1));
    const cuota1 = historial.find((h) => h.numeroCuota === 1)!;
    expect(cuota1.estado).toBe("OVERDUE");
    expect(cuota1.diasAtraso).toBe(1);
    // La del día en curso sigue siendo PENDING.
    expect(historial.find((h) => h.numeroCuota === 2)!.estado).toBe("PENDING");
  });

  it("sigue OVERDUE hasta el día 6 de atraso", () => {
    const historial = buildPaymentHistory(credito, [], dia(6));
    const cuota1 = historial.find((h) => h.numeroCuota === 1)!;
    expect(cuota1.diasAtraso).toBe(6);
    expect(cuota1.estado).toBe("OVERDUE");
  });

  it("pasa a DEFAULTED (mora) a los 7 días de atraso", () => {
    const historial = buildPaymentHistory(credito, [], dia(7));
    const cuota1 = historial.find((h) => h.numeroCuota === 1)!;
    expect(cuota1.diasAtraso).toBe(7);
    expect(cuota1.estado).toBe("DEFAULTED");
  });

  it("no genera cuotas sin pagar más allá de `dias` (tope del plazo del crédito)", () => {
    const creditoCorto = { id: "cr-2", fechaInicio: dia(0), dias: 2 };
    const historial = buildPaymentHistory(creditoCorto, [], dia(10));
    expect(historial).toHaveLength(2);
  });
});

describe("computeProximaFechaCuota", () => {
  it("devuelve la fecha del día siguiente a las cuotas ya pagadas", () => {
    const proxima = computeProximaFechaCuota({
      fechaInicio: dia(0),
      dias: 30,
      cuotasPagadas: 12,
      estado: "ACTIVO",
    });
    expect(proxima).toBe(new Date(dia(0).getTime() + 12 * DIA_MS).toISOString());
  });

  it("devuelve null si el crédito está PAGADO", () => {
    const proxima = computeProximaFechaCuota({
      fechaInicio: dia(0),
      dias: 30,
      cuotasPagadas: 30,
      estado: "PAGADO",
    });
    expect(proxima).toBeNull();
  });

  it("devuelve null si el crédito está ANULADO", () => {
    const proxima = computeProximaFechaCuota({
      fechaInicio: dia(0),
      dias: 30,
      cuotasPagadas: 5,
      estado: "ANULADO",
    });
    expect(proxima).toBeNull();
  });

  it("devuelve null si ya se pagaron todas las cuotas (crédito ACTIVO por error de rollup)", () => {
    const proxima = computeProximaFechaCuota({
      fechaInicio: dia(0),
      dias: 30,
      cuotasPagadas: 30,
      estado: "ACTIVO",
    });
    expect(proxima).toBeNull();
  });
});

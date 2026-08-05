import { dayRange, localDateKey, startOfLocalDay, utcDateKey } from "./day-boundary.util";

const BOGOTA = "America/Bogota";

describe("dayRange (America/Bogota, UTC-5)", () => {
  it("la medianoche local de un día cae a las 05:00 UTC de ese mismo día", () => {
    // Cualquier instante del 5 de agosto en Bogotá (ej. mediodía UTC, 07:00 local).
    const { start, end } = dayRange(new Date("2026-08-05T12:00:00.000Z"), BOGOTA);
    expect(start.toISOString()).toBe("2026-08-05T05:00:00.000Z");
    expect(end.toISOString()).toBe("2026-08-06T05:00:00.000Z");
  });

  it("un pago a las 23:30 America/Bogota cae en el día local correcto", () => {
    // 23:30 del 5 de agosto en Bogotá = 04:30 UTC del 6 de agosto.
    const pago = new Date("2026-08-06T04:30:00.000Z");
    const { start, end } = dayRange(pago, BOGOTA);
    // El rango del día al que pertenece el pago es el 5 de agosto, no el 6.
    expect(start.toISOString()).toBe("2026-08-05T05:00:00.000Z");
    expect(end.toISOString()).toBe("2026-08-06T05:00:00.000Z");
    expect(pago >= start && pago < end).toBe(true);
  });

  it("un pago justo en el límite (04:59:59.999 UTC) todavía pertenece al día anterior", () => {
    const pago = new Date("2026-08-06T04:59:59.999Z");
    const { start, end } = dayRange(new Date("2026-08-05T12:00:00.000Z"), BOGOTA);
    expect(pago >= start && pago < end).toBe(true);
  });

  it("un pago justo en 05:00:00.000 UTC ya pertenece al día siguiente", () => {
    const pago = new Date("2026-08-06T05:00:00.000Z");
    const { start, end } = dayRange(new Date("2026-08-05T12:00:00.000Z"), BOGOTA);
    expect(pago >= start && pago < end).toBe(false);
  });

  it("el rango dura exactamente 24 horas (Bogotá no tiene DST)", () => {
    const { start, end } = dayRange(new Date("2026-01-15T00:00:00.000Z"), BOGOTA);
    expect(end.getTime() - start.getTime()).toBe(24 * 60 * 60 * 1000);
  });

  it("cruza correctamente un fin de mes/año", () => {
    // 31 dic 23:00 UTC = 31 dic 18:00 Bogotá, sigue siendo el 31 en ambas.
    const { start, end } = dayRange(new Date("2025-12-31T23:00:00.000Z"), BOGOTA);
    expect(start.toISOString()).toBe("2025-12-31T05:00:00.000Z");
    expect(end.toISOString()).toBe("2026-01-01T05:00:00.000Z");
  });
});

describe("startOfLocalDay", () => {
  it("coincide siempre con el `start` de `dayRange` para el mismo instante", () => {
    const instante = new Date("2026-03-10T02:00:00.000Z");
    expect(startOfLocalDay(instante, BOGOTA).toISOString()).toBe(
      dayRange(instante, BOGOTA).start.toISOString(),
    );
  });

  it("es estable sin importar la hora del día del instante de entrada", () => {
    const manana = startOfLocalDay(new Date("2026-08-05T05:01:00.000Z"), BOGOTA); // 00:01 local
    const noche = startOfLocalDay(new Date("2026-08-06T04:59:00.000Z"), BOGOTA); // 23:59 local, mismo día
    expect(manana.toISOString()).toBe(noche.toISOString());
  });
});

describe("localDateKey / utcDateKey", () => {
  it("localDateKey lee el día calendario EN la zona, no en UTC", () => {
    // 23:30 del 5 de agosto Bogotá = 04:30 UTC del 6 — el día local sigue siendo el 5.
    expect(localDateKey(new Date("2026-08-06T04:30:00.000Z"), BOGOTA)).toBe("2026-08-05");
  });

  it("utcDateKey lee el día calendario en UTC directo, sin convertir zona", () => {
    // Un valor `@db.Date` tal como lo devuelve Prisma: medianoche UTC pura.
    expect(utcDateKey(new Date("2026-08-05T00:00:00.000Z"))).toBe("2026-08-05");
  });

  it("utcDateKey(startOfLocalDay(x)) reconstruye el mismo día que localDateKey(x)", () => {
    // Es la propiedad que hace válida la comparación de `isRouteClosedOn`:
    // comparar `utcDateKey` de un valor persistido contra `localDateKey` del
    // instante que se está evaluando debe dar la misma clave.
    const instante = new Date("2026-11-20T15:00:00.000Z");
    expect(utcDateKey(startOfLocalDay(instante, BOGOTA))).toBe(localDateKey(instante, BOGOTA));
  });
});

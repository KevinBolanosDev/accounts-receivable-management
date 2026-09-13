import type { Receipt } from "@repo/types";

import { buildReceiptPdf, receiptPdfFilename } from "./receipt-pdf";

// El recibo es la única superficie del sistema cuyo layout NADIE puede revisar
// leyendo el código: es un PDF dibujado con coordenadas, no HTML inspeccionable
// en un navegador. Estos tests fijan las dos propiedades que sí se pueden
// verificar sin ojos, y que son justamente las que un cambio de plantilla
// rompe en silencio.

function makeReceipt(overrides: Partial<Receipt> = {}): Receipt {
  return {
    id: "pago-1",
    pagoId: "pago-1",
    codigo: "R-A1B2C3",
    createdAt: "2026-08-13T15:30:00.000Z",
    credito: {
      codigo: "CR-2041",
      clienteNombre: "María Fernanda Gutiérrez Rodríguez",
      productoNombre: "Motocicleta Bajaj Boxer CT 100 KS",
      capital: 1_200_000,
      interes: 20,
      montoTotal: 1_440_000,
      cuotaValor: 72_000,
      cuotas: 20,
      frecuencia: "DIARIO",
    },
    monto: 72_000,
    saldoRestante: 1_080_000,
    fecha: "2026-08-13T15:30:00.000Z",
    cobradorNombre: "Juan Carlos Pérez",
    numeroCuota: 5,
    cuotasPagadas: 5,
    cuotasRestantes: 15,
    cuotasPagadasDetalle: cuotas(5),
    reciboPublicUrl: "https://api.example.com/r/token",
    clienteTelefono: "+573001234567",
    anulado: false,
    ...overrides,
  };
}

function cuotas(n: number): Receipt["cuotasPagadasDetalle"] {
  return Array.from({ length: n }, (_, i) => ({
    numeroCuota: i + 1,
    monto: 72_000,
    fechaPago: new Date(Date.UTC(2026, 6, 20 + i, 15)).toISOString(),
    estado: i % 3 === 0 ? ("LATE" as const) : ("ON_TIME" as const),
  }));
}

// pdfkit escribe un objeto `/Type /Page` por página (el árbol de páginas es
// `/Type /Pages`, de ahí el `[^s]`). Si el contenido excede el alto calculado
// en `buildReceiptPdf`, pdfkit agrega una página sin avisar y el recibo sale
// partido en dos — el modo de falla exacto que este test existe para atrapar.
function pageCount(buf: Buffer): number {
  return (buf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) ?? []).length;
}

describe("buildReceiptPdf", () => {
  it("produce un PDF válido", async () => {
    const buf = await buildReceiptPdf(makeReceipt());
    expect(buf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    expect(buf.length).toBeGreaterThan(500);
  });

  // El alto de página lo decide `measureHeight` (una pasada de dibujo previa),
  // así que hay que probar los extremos: sin cuotas, un plan normal, uno largo.
  it.each([
    ["sin cuotas pagadas", 0],
    ["una cuota", 1],
    ["plan diario completo", 20],
    ["plan largo", 60],
  ])("cabe en una sola página: %s", async (_caso, n) => {
    const buf = await buildReceiptPdf(
      makeReceipt({
        cuotasPagadasDetalle: cuotas(n),
        cuotasPagadas: n,
        numeroCuota: n,
        cuotasRestantes: Math.max(0, 20 - n),
      }),
    );
    expect(pageCount(buf)).toBe(1);
  });

  // El banner de anulado suma alto propio: si no se contempla en el cálculo,
  // el mismo recibo que cabía pasa a desbordar solo por estar anulado.
  it("cabe en una sola página estando anulado", async () => {
    const buf = await buildReceiptPdf(
      makeReceipt({ anulado: true, cuotasPagadasDetalle: cuotas(20) }),
    );
    expect(pageCount(buf)).toBe(1);
  });

  // Un pago anulado no ocupa lugar en el cronograma (`numeroCuota: 0`), así que
  // la línea "Cuota N de M" se omite. Sin este caso, dibujar "Cuota 0 de 20"
  // pasaría desapercibido.
  it("no rompe con un pago anulado sin posición en el cronograma", async () => {
    const buf = await buildReceiptPdf(
      makeReceipt({
        anulado: true,
        numeroCuota: 0,
        cuotasPagadas: 0,
        cuotasRestantes: 0,
        cuotasPagadasDetalle: [],
      }),
    );
    expect(pageCount(buf)).toBe(1);
  });
});

describe("receiptPdfFilename", () => {
  it("usa el código del recibo", () => {
    expect(receiptPdfFilename("R-A1B2C3")).toBe("recibo-R-A1B2C3.pdf");
  });

  // El valor termina dentro de una cabecera `Content-Disposition`: una comilla
  // o un salto de línea ahí serían inyección de cabecera.
  it("sanea caracteres que romperían la cabecera HTTP", () => {
    expect(receiptPdfFilename('R-1"; drop\n')).toBe("recibo-R-1drop.pdf");
    expect(receiptPdfFilename("///")).toBe("recibo-recibo.pdf");
  });
});

import PDFDocument from "pdfkit";
import type { DailyClosure } from "@repo/types";

// Paleta/tipografía alineadas con `receipts.service.ts` (mismo recibo HTML).
const COLORS = {
  primary: "#4f46e5",
  text: "#18181b",
  mutedFg: "#71717a",
  border: "#e4e4e7",
  destructive: "#b91c1c",
};

const PAGE_MARGIN = 50;
const CONTENT_WIDTH = 495; // A4 (595pt) - 2×margin

function formatCop(n: number): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(n);
}

// `closure.date` es "YYYY-MM-DD" (día calendario, sin hora): se ancla al
// mediodía UTC antes de formatear en `America/Bogota`, mismo truco que
// `parseFechaInicio` — si no, un cierre del 5 podría verse el 4.
function formatFecha(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(y!, m! - 1, d, 12));
  return date.toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "America/Bogota",
  });
}

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString("es-CO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Bogota",
  });
}

/**
 * Fase 5.8 — PDF on-demand del cierre diario. Función PURA: recibe el DTO ya
 * armado (el mismo que `GET /daily-closures/:id`) y devuelve los bytes; nunca
 * toca Prisma ni Storage. Aislada del service a propósito: swappear a
 * `puppeteer` en Fase 6 (si se pide fidelidad visual con el recibo HTML) no
 * debería tocar `daily-closures.service.ts`.
 */
export function buildClosurePdf(closure: DailyClosure): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: PAGE_MARGIN });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    drawHeader(doc, closure);
    drawDivider(doc);
    drawMetrics(doc, closure);
    drawDivider(doc);
    drawPaidClients(doc, closure);
    drawDivider(doc);
    drawUnpaidClients(doc, closure);
    drawFooter(doc, closure);

    doc.end();
  });
}

function drawDivider(doc: PDFKit.PDFDocument): void {
  doc.moveDown(0.6);
  const y = doc.y;
  doc
    .strokeColor(COLORS.border)
    .lineWidth(1)
    .moveTo(PAGE_MARGIN, y)
    .lineTo(PAGE_MARGIN + CONTENT_WIDTH, y)
    .stroke();
  doc.moveDown(0.6);
}

function drawHeader(doc: PDFKit.PDFDocument, closure: DailyClosure): void {
  doc.fillColor(COLORS.mutedFg).font("Helvetica").fontSize(9).text("COBRODIARIO · CIERRE DIARIO");
  doc.moveDown(0.3);
  doc.fillColor(COLORS.text).font("Helvetica-Bold").fontSize(20).text(closure.rutaNombre);
  doc.fillColor(COLORS.primary).font("Helvetica").fontSize(12).text(formatFecha(closure.date));
}

// Filas simples "etiqueta ... valor" en flujo vertical (sin columnas
// absolutas): robusto ante cambios de fuente/idioma y fácil de mantener sin
// poder previsualizar el render.
function drawMetrics(doc: PDFKit.PDFDocument, closure: DailyClosure): void {
  doc.fillColor(COLORS.text).font("Helvetica-Bold").fontSize(12).text("Resumen del día");
  doc.moveDown(0.4);

  const rows: [string, string][] = [
    ["Total cobrado", formatCop(closure.totalCollected)],
    ["Cobros registrados", String(closure.collectedCount)],
    ["Créditos nuevos", String(closure.newCredits)],
    ["Monto en créditos nuevos", formatCop(closure.newCreditsAmount)],
    ["Productos vendidos", String(closure.productsSold)],
    ["Clientes sin pagar", String(closure.unpaidCount)],
  ];

  for (const [label, value] of rows) {
    doc
      .fontSize(10)
      .font("Helvetica")
      .fillColor(COLORS.mutedFg)
      .text(label, PAGE_MARGIN, doc.y, { continued: true, width: CONTENT_WIDTH });
    doc.font("Helvetica-Bold").fillColor(COLORS.text).text(`  ${value}`, { align: "right" });
  }
}

// Una fila por PAGO, no por cliente (alguien puede pagar más de una cuota el
// mismo día) — mismo criterio que `paidClients` en `daily-closure.util.ts`.
function drawPaidClients(doc: PDFKit.PDFDocument, closure: DailyClosure): void {
  doc.fillColor(COLORS.text).font("Helvetica-Bold").fontSize(12).text("Clientes que pagaron");
  doc.moveDown(0.4);

  // `null` = cierre de antes de que este campo existiera (nunca se
  // recalcula) — se distingue de "nadie pagó", que sería un array vacío.
  if (closure.paidClients === null) {
    doc
      .fillColor(COLORS.mutedFg)
      .font("Helvetica")
      .fontSize(10)
      .text("No disponible para cierres anteriores a esta función.");
    return;
  }

  if (closure.paidClients.length === 0) {
    doc.fillColor(COLORS.mutedFg).font("Helvetica").fontSize(10).text("Nadie pagó este día.");
    return;
  }

  const col = { nombre: PAGE_MARGIN, cuota: PAGE_MARGIN + 300, monto: PAGE_MARGIN + 390 };
  const rowHeight = 18;

  drawPaidRow(doc, col, ["CLIENTE", "CUOTA", "MONTO"], {
    font: "Helvetica-Bold",
    color: COLORS.mutedFg,
    size: 8,
  });
  doc.y += rowHeight * 0.6;

  for (const pago of closure.paidClients) {
    if (doc.y > 780) {
      doc.addPage();
      drawPaidRow(doc, col, ["CLIENTE", "CUOTA", "MONTO"], {
        font: "Helvetica-Bold",
        color: COLORS.mutedFg,
        size: 8,
      });
      doc.y += rowHeight * 0.6;
    }

    drawPaidRow(doc, col, [pago.clienteNombre, `#${pago.numeroCuota}`, formatCop(pago.monto)], {
      font: "Helvetica",
      color: COLORS.text,
      size: 10,
    });
    doc.y += rowHeight;
  }
}

function drawPaidRow(
  doc: PDFKit.PDFDocument,
  col: { nombre: number; cuota: number; monto: number },
  [nombre, cuota, monto]: [string, string, string],
  style: { font: string; color: string; size: number },
): void {
  const y = doc.y;
  doc.font(style.font).fontSize(style.size);
  doc.fillColor(style.color).text(nombre, col.nombre, y, { width: col.cuota - col.nombre - 10 });
  doc.fillColor(style.color).text(cuota, col.cuota, y, { width: col.monto - col.cuota - 10 });
  doc.fillColor(style.color).text(monto, col.monto, y);
  doc.y = y; // mismo truco que `drawTableRow`: fija el cursor para que `rowHeight` lo avance una sola vez.
}

function drawUnpaidClients(doc: PDFKit.PDFDocument, closure: DailyClosure): void {
  doc.fillColor(COLORS.text).font("Helvetica-Bold").fontSize(12).text("Clientes sin pagar");
  doc.moveDown(0.4);

  if (closure.unpaidClients.length === 0) {
    doc
      .fillColor(COLORS.mutedFg)
      .font("Helvetica")
      .fontSize(10)
      .text("Todos los clientes de la ruta pagaron este día.");
    return;
  }

  const col = { nombre: PAGE_MARGIN, telefono: PAGE_MARGIN + 260, saldo: PAGE_MARGIN + 390 };
  const rowHeight = 18;

  drawTableRow(doc, col, ["CLIENTE", "TELÉFONO", "SALDO"], {
    font: "Helvetica-Bold",
    color: COLORS.mutedFg,
    size: 8,
  });
  doc.y += rowHeight * 0.6;

  for (const cliente of closure.unpaidClients) {
    // Salto de página manual: pdfkit no sabe que esto es una "tabla", así que
    // el chequeo de espacio restante es responsabilidad de este loop.
    if (doc.y > 780) {
      doc.addPage();
      drawTableRow(doc, col, ["CLIENTE", "TELÉFONO", "SALDO"], {
        font: "Helvetica-Bold",
        color: COLORS.mutedFg,
        size: 8,
      });
      doc.y += rowHeight * 0.6;
    }

    drawTableRow(
      doc,
      col,
      [cliente.nombre, cliente.telefono ?? "—", formatCop(cliente.saldoPendiente)],
      { font: "Helvetica", color: COLORS.text, size: 10 },
      { saldo: COLORS.destructive },
    );
    doc.y += rowHeight;
  }
}

function drawTableRow(
  doc: PDFKit.PDFDocument,
  col: { nombre: number; telefono: number; saldo: number },
  [nombre, telefono, saldo]: [string, string, string],
  style: { font: string; color: string; size: number },
  overrideColor?: { saldo?: string },
): void {
  const y = doc.y;
  doc.font(style.font).fontSize(style.size);
  doc.fillColor(style.color).text(nombre, col.nombre, y, { width: col.telefono - col.nombre - 10 });
  doc
    .fillColor(style.color)
    .text(telefono, col.telefono, y, { width: col.saldo - col.telefono - 10 });
  doc.fillColor(overrideColor?.saldo ?? style.color).text(saldo, col.saldo, y);
  doc.y = y; // las tres `.text()` de arriba mueven el cursor; se fija para que `rowHeight` lo avance una sola vez.
}

function drawFooter(doc: PDFKit.PDFDocument, closure: DailyClosure): void {
  drawDivider(doc);
  doc
    .fillColor(COLORS.mutedFg)
    .font("Helvetica")
    .fontSize(9)
    .text(
      `Cerrado por ${closure.closedByNombre ?? "cierre automático"} · ${formatTimestamp(closure.createdAt)}`,
    );
}

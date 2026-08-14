import PDFDocument from "pdfkit";
import type { Receipt, ReceiptInstallment } from "@repo/types";

/**
 * PDF del recibo de pago. Función PURA: recibe el DTO ya armado (el mismo que
 * `GET /payments/:pagoId`) y devuelve los bytes; nunca toca Prisma ni Storage.
 * Mismo patrón que `closure-pdf.ts` — el service no sabe cómo se dibuja.
 *
 * Reemplaza la plantilla HTML server-rendered que este módulo servía hasta
 * ahora. El recibo se volvió PDF en los TRES consumidores a la vez (staff,
 * portal del cliente y el enlace público `/r/:token`) justamente para que
 * siga habiendo una sola plantilla: mantener HTML para pantalla y PDF para
 * descarga habría significado dos documentos que se desincronizan.
 */

// Paleta alineada con el resto del sistema (misma que `closure-pdf.ts`).
const COLORS = {
  primary: "#4f46e5",
  text: "#18181b",
  mutedFg: "#71717a",
  border: "#e4e4e7",
  destructive: "#b91c1c",
  success: "#15803d",
};

// Formato TICKET (~80mm de ancho), no A4. Un recibo de una cuota diaria es un
// comprobante de caja, no una hoja carta: en el teléfono del cliente — que es
// donde se abre, vía el enlace de WhatsApp — el visor de PDF ajusta al ancho,
// así que una página angosta se lee sin zoom mientras que una A4 obliga a
// hacer pinch. También es la forma que la gente reconoce como "recibo".
const PAGE_WIDTH = 227; // 80mm en puntos
const MARGIN = 14;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

const ROW_HEIGHT = 12;

const ESTADO_LABEL: Record<string, string> = {
  ON_TIME: "A tiempo",
  LATE: "Tarde",
};

const FRECUENCIA_LABEL: Record<string, string> = {
  DIARIO: "Diaria",
  SEMANAL: "Semanal",
  MENSUAL: "Mensual",
};

function formatCop(n: number): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(n);
}

// Fecha CON hora: un cobrador puede registrar varios pagos del mismo cliente
// el mismo día, y sin la hora los recibos son indistinguibles entre sí.
// `timeZone` fijo: el server corre en UTC y sin esto el recibo mostraría una
// hora distinta a la que ve el cobrador en pantalla.
function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("es-CO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Bogota",
  });
}

function formatDateShort(iso: string): string {
  return new Date(iso).toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    timeZone: "America/Bogota",
  });
}

/**
 * Nombre del archivo que ve el usuario al guardar. El código del recibo ya es
 * corto y seguro para un filename (`R-XXXXXX`, ver `receipt-code.util.ts`),
 * pero se sanea igual: es un valor que termina en una cabecera HTTP y no debe
 * poder inyectar comillas ni saltos de línea.
 */
export function receiptPdfFilename(codigo: string): string {
  const slug = codigo.replace(/[^a-zA-Z0-9-_]/g, "") || "recibo";
  return `recibo-${slug}.pdf`;
}

/** Todo el contenido del recibo, en orden. Se ejecuta dos veces — ver `buildReceiptPdf`. */
function render(doc: PDFKit.PDFDocument, receipt: Receipt): void {
  drawHeader(doc, receipt);
  if (receipt.anulado) drawVoidBanner(doc);
  drawAmount(doc, receipt);
  drawParties(doc, receipt);
  drawCreditTerms(doc, receipt);
  drawProgress(doc, receipt);
  drawInstallments(doc, receipt.cuotasPagadasDetalle);
  drawFooter(doc, receipt);
}

// Lienzo de medición: más alto que cualquier recibo imaginable, para que la
// pasada de medición nunca dispare un salto de página (que sí falsearía el
// `doc.y` final).
const MEASURE_HEIGHT = 20_000;

/**
 * Holgura al pie, en puntos. NO es decorativa: sin ella el recibo salía en DOS
 * páginas por redondeo. La medición da el alto exacto del contenido, así que
 * `maxY` de la página real queda EXACTAMENTE en el pie de la última línea; y
 * pdfkit decide el salto con `y + altoDeLínea > maxY`, recalculando esa suma
 * con floats — `385.44000000000005 > 385.43999999999994` da `true` y mete una
 * página de más para una sola línea. Un punto de holgura absorbe el error
 * (que es del orden de 1e-13) y de paso evita que el texto quede pegado al
 * borde inferior.
 */
const HEIGHT_EPSILON = 2;

/**
 * Cuánto mide el recibo dibujado, en puntos.
 *
 * pdfkit exige el tamaño de página AL CONSTRUIR el documento, antes de saber
 * cuánto ocupa el contenido. La alternativa obvia —estimar con una constante
 * más `nºCuotas × altoDeFila`— ya falló acá: la primera versión se desbordaba
 * a dos páginas, y ese tipo de constante vuelve a quedar corta en silencio
 * cada vez que alguien agrega una línea a una sección.
 *
 * Así que se dibuja dos veces: la primera sobre un lienzo altísimo solo para
 * leer dónde terminó el cursor, la segunda sobre una página de exactamente ese
 * alto. El layout no depende del alto de página (todas las posiciones son
 * absolutas desde arriba), así que las dos pasadas producen lo mismo. El costo
 * es despreciable —el documento es diminuto— y a cambio el alto no puede
 * desincronizarse del contenido nunca más.
 */
function measureHeight(receipt: Receipt): number {
  const doc = new PDFDocument({ size: [PAGE_WIDTH, MEASURE_HEIGHT], margin: MARGIN });
  // Sin un consumidor, el stream acumula en memoria hasta el `end`. Se descarta
  // explícitamente: de esta pasada solo interesa el cursor, no los bytes.
  doc.on("data", () => {});
  render(doc, receipt);
  const height = doc.y + MARGIN + HEIGHT_EPSILON;
  doc.end();
  return height;
}

export function buildReceiptPdf(receipt: Receipt): Promise<Buffer> {
  const height = measureHeight(receipt);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: [PAGE_WIDTH, height], margin: MARGIN });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    render(doc, receipt);

    doc.end();
  });
}

// === primitivas de layout ==================================================
// Todas fijan `doc.y` explícitamente al terminar. pdfkit avanza el cursor por
// su cuenta según cuánto ocupó el texto, y con dos `.text()` en la misma línea
// (etiqueta + valor) ese avance se duplica — el mismo cuidado que ya tienen
// `drawTableRow`/`drawPaidRow` en `closure-pdf.ts`.

function divider(doc: PDFKit.PDFDocument, gap = 6): void {
  const y = doc.y + gap;
  doc
    .strokeColor(COLORS.border)
    .lineWidth(0.5)
    .moveTo(MARGIN, y)
    .lineTo(MARGIN + CONTENT_WIDTH, y)
    .stroke();
  doc.y = y + gap;
}

function sectionTitle(doc: PDFKit.PDFDocument, text: string): void {
  doc
    .font("Helvetica-Bold")
    .fontSize(7)
    .fillColor(COLORS.mutedFg)
    .text(text.toUpperCase(), MARGIN, doc.y, { width: CONTENT_WIDTH, characterSpacing: 0.5 });
  doc.y += 3;
}

/** Fila "etiqueta … valor" en dos columnas. Para valores cortos (números, fechas). */
function row(
  doc: PDFKit.PDFDocument,
  label: string,
  value: string,
  opts: { bold?: boolean; valueColor?: string; size?: number } = {},
): void {
  const size = opts.size ?? 7.5;
  const y = doc.y;
  const half = CONTENT_WIDTH / 2;

  doc
    .font("Helvetica")
    .fontSize(size)
    .fillColor(COLORS.mutedFg)
    .text(label, MARGIN, y, { width: half, lineBreak: false });
  doc
    .font(opts.bold ? "Helvetica-Bold" : "Helvetica")
    .fontSize(size)
    .fillColor(opts.valueColor ?? COLORS.text)
    .text(value, MARGIN + half, y, { width: half, align: "right", lineBreak: false });

  doc.y = y + size + 4;
}

/**
 * Etiqueta arriba, valor abajo. Para textos que pueden ser largos (nombre del
 * cliente, producto): en un ticket de 80mm no entran a la derecha de su
 * etiqueta sin cortarse, y truncar el nombre de la persona en su propio
 * recibo no es aceptable.
 */
function stacked(doc: PDFKit.PDFDocument, label: string, value: string): void {
  doc
    .font("Helvetica")
    .fontSize(6.5)
    .fillColor(COLORS.mutedFg)
    .text(label.toUpperCase(), MARGIN, doc.y, { width: CONTENT_WIDTH, characterSpacing: 0.4 });
  doc
    .font("Helvetica-Bold")
    .fontSize(8.5)
    .fillColor(COLORS.text)
    .text(value, MARGIN, doc.y + 1, { width: CONTENT_WIDTH });
  doc.y += 3;
}

// === secciones =============================================================

function drawHeader(doc: PDFKit.PDFDocument, r: Receipt): void {
  doc
    .font("Helvetica")
    .fontSize(6.5)
    .fillColor(COLORS.mutedFg)
    .text("RECIBO DE PAGO", MARGIN, doc.y, {
      width: CONTENT_WIDTH,
      align: "center",
      characterSpacing: 0.6,
    });
  doc
    .font("Helvetica-Bold")
    .fontSize(13)
    .fillColor(COLORS.text)
    .text(r.codigo, MARGIN, doc.y + 2, { width: CONTENT_WIDTH, align: "center" });
  doc.y += 2;
}

function drawVoidBanner(doc: PDFKit.PDFDocument): void {
  const y = doc.y + 4;
  doc.rect(MARGIN, y, CONTENT_WIDTH, 20).fill("#fef2f2");
  doc
    .font("Helvetica-Bold")
    .fontSize(7.5)
    .fillColor(COLORS.destructive)
    .text("PAGO ANULADO — no cuenta como abono", MARGIN, y + 6.5, {
      width: CONTENT_WIDTH,
      align: "center",
    });
  doc.y = y + 24;
}

// El monto pagado deja de ser el titular gigante que era en el HTML (36px).
// Sigue siendo lo primero que se lee, pero a un tamaño que deja lugar al
// resto de la información en la misma vista, sin scroll.
function drawAmount(doc: PDFKit.PDFDocument, r: Receipt): void {
  divider(doc, 5);
  doc
    .font("Helvetica")
    .fontSize(6.5)
    .fillColor(COLORS.mutedFg)
    .text("MONTO PAGADO", MARGIN, doc.y, {
      width: CONTENT_WIDTH,
      align: "center",
      characterSpacing: 0.5,
    });
  doc
    .font("Helvetica-Bold")
    .fontSize(14)
    .fillColor(COLORS.primary)
    .text(formatCop(r.monto), MARGIN, doc.y + 1, { width: CONTENT_WIDTH, align: "center" });
  doc.y += 2;
  divider(doc, 5);
}

function drawParties(doc: PDFKit.PDFDocument, r: Receipt): void {
  stacked(doc, "Cliente", r.credito.clienteNombre);
  stacked(doc, "Producto", r.credito.productoNombre);
  doc.y += 2;
  row(doc, "Crédito", r.credito.codigo, { bold: true });
  row(doc, "Fecha", formatDateTime(r.fecha));
  row(doc, "Cobrador", r.cobradorNombre);
}

function drawCreditTerms(doc: PDFKit.PDFDocument, r: Receipt): void {
  divider(doc);
  sectionTitle(doc, "El crédito");

  const c = r.credito;
  row(doc, "Valor del crédito", formatCop(c.capital));
  row(doc, "Interés", `${c.interes}%`);
  row(doc, "Total a pagar", formatCop(c.montoTotal), { bold: true });
  row(doc, `Cuota (${FRECUENCIA_LABEL[c.frecuencia] ?? c.frecuencia})`, formatCop(c.cuotaValor));
  row(doc, "N.º de cuotas", String(c.cuotas));
}

function drawProgress(doc: PDFKit.PDFDocument, r: Receipt): void {
  divider(doc);
  sectionTitle(doc, "Estado al momento del pago");

  // Un pago anulado no ocupa un lugar en el cronograma (`numeroCuota: 0`), así
  // que la línea "Cuota N de M" se omite en vez de imprimir "Cuota 0 de 20".
  if (r.numeroCuota > 0) {
    row(doc, "Esta cuota", `${r.numeroCuota} de ${r.credito.cuotas}`, { bold: true });
  }
  row(doc, "Cuotas pagadas", String(r.cuotasPagadas), { valueColor: COLORS.success });
  row(doc, "Cuotas restantes", String(r.cuotasRestantes));
  row(doc, "Saldo restante", formatCop(r.saldoRestante), { bold: true, size: 9 });
}

function drawInstallments(doc: PDFKit.PDFDocument, cuotas: ReceiptInstallment[]): void {
  divider(doc);
  sectionTitle(doc, "Cuotas pagadas");

  if (cuotas.length === 0) {
    doc
      .font("Helvetica")
      .fontSize(7)
      .fillColor(COLORS.mutedFg)
      .text("Sin cuotas pagadas registradas.", MARGIN, doc.y, { width: CONTENT_WIDTH });
    doc.y += 4;
    return;
  }

  // Columnas fijas: el ticket es angosto y las cuatro celdas son cortas
  // (número, fecha corta, monto, estado), así que no hace falta medir texto.
  const col = { n: MARGIN, fecha: MARGIN + 24, monto: MARGIN + 78, estado: MARGIN + 138 };

  const head = (text: string, x: number, width: number, align: "left" | "right" = "left") => {
    doc
      .font("Helvetica-Bold")
      .fontSize(6)
      .fillColor(COLORS.mutedFg)
      .text(text, x, doc.y, { width, align, lineBreak: false });
  };

  const y0 = doc.y;
  head("N.º", col.n, 20);
  doc.y = y0;
  head("FECHA", col.fecha, 50);
  doc.y = y0;
  head("MONTO", col.monto, 55, "right");
  doc.y = y0;
  head("ESTADO", col.estado, CONTENT_WIDTH + MARGIN - col.estado, "right");
  doc.y = y0 + 9;

  for (const cuota of cuotas) {
    const y = doc.y;
    const esTarde = cuota.estado === "LATE";

    doc.font("Helvetica").fontSize(7).fillColor(COLORS.text);
    doc.text(String(cuota.numeroCuota), col.n, y, { width: 20, lineBreak: false });
    doc.text(formatDateShort(cuota.fechaPago), col.fecha, y, { width: 50, lineBreak: false });
    doc.text(formatCop(cuota.monto), col.monto, y, { width: 55, align: "right", lineBreak: false });
    doc
      .fillColor(esTarde ? COLORS.destructive : COLORS.success)
      .text(ESTADO_LABEL[cuota.estado] ?? cuota.estado, col.estado, y, {
        width: CONTENT_WIDTH + MARGIN - col.estado,
        align: "right",
        lineBreak: false,
      });

    doc.y = y + ROW_HEIGHT;
  }
}

function drawFooter(doc: PDFKit.PDFDocument, r: Receipt): void {
  divider(doc);
  doc
    .font("Helvetica")
    .fontSize(6)
    .fillColor(COLORS.mutedFg)
    .text(`Emitido el ${formatDateTime(r.createdAt)}`, MARGIN, doc.y, {
      width: CONTENT_WIDTH,
      align: "center",
    });
  doc.text("Conserva este comprobante.", MARGIN, doc.y + 1, {
    width: CONTENT_WIDTH,
    align: "center",
  });
}

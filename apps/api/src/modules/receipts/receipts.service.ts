import { Injectable, NotFoundException } from "@nestjs/common";
import type { Receipt } from "@repo/types";

import { PrismaService } from "../../core/prisma/prisma.service";

// Servicio del módulo `receipts` (Fase 4). No tiene repository propio —
// `Receipt` es un view-model agregado sobre `Pago` + `Credito` + `Cliente`
// + `Producto` + `Usuario`. La capa de datos la maneja Prisma directo
// porque el feature es de solo lectura y no comparte modelo con otros.
@Injectable()
export class ReceiptsService {
  constructor(private readonly prisma: PrismaService) {}

  // Construye el shape `Receipt` para un pago existente. Lanza 404 si el
  // pago no existe.
  async getReceipt(pagoId: string): Promise<Receipt> {
    const pago = await this.prisma.pago.findUnique({
      where: { id: pagoId },
      include: {
        credito: {
          include: {
            cliente: { select: { nombre: true } },
            producto: { select: { nombre: true } },
          },
        },
        cobrador: { select: { nombre: true } },
      },
    });
    if (!pago) {
      throw new NotFoundException("Pago no encontrado.");
    }

    // El saldo restante al momento del pago no se persiste — se deriva del
    // `credito.saldoPendiente` ACTUAL menos los pagos POSTERIORES. Si el
    // crédito ya está saldado y no hay pagos posteriores, `saldoRestante`
    // coincide con `credito.saldoPendiente`.
    const pagosPosteriores = await this.prisma.pago.aggregate({
      where: {
        creditoId: pago.creditoId,
        fecha: { gt: pago.fecha },
      },
      _sum: { monto: true },
    });
    const saldoRestante =
      Number(pago.credito.saldoPendiente.toString()) +
      Number(pagosPosteriores._sum.monto?.toString() ?? "0");

    return {
      id: pago.id,
      pagoId: pago.id,
      codigo: `R-${pago.id.slice(0, 8).toUpperCase()}`,
      createdAt: pago.createdAt.toISOString(),
      credito: {
        codigo: pago.credito.codigo,
        clienteNombre: pago.credito.cliente.nombre,
        productoNombre: pago.credito.producto.nombre,
      },
      monto: Number(pago.monto.toString()),
      saldoRestante,
      fecha: pago.fecha.toISOString(),
      cobradorNombre: pago.cobrador.nombre,
    };
  }

  // Construye el HTML server-rendered del recibo. Es un documento STANDALONE:
  // CSS inline, sin Tailwind, sin necesidad del SPA. Diseñado para abrirse
  // directamente desde WhatsApp sin autenticación (futuro público).
  //
  // Por ahora el endpoint está protegido por JWT (staff). En Fase 4.11 se
  // agregará un endpoint público con token (cuando se reactive la variante
  // por token — hoy no es necesaria porque el cliente entra por credenciales).
  async getReceiptHtml(pagoId: string): Promise<string> {
    const receipt = await this.getReceipt(pagoId);
    return buildReceiptHtml(receipt);
  }
}

// === HTML builder =====================================================
// Plantilla standalone con CSS inline. No usa Tailwind ni dependencias del
// SPA — el recibo es un documento que se abre solo.

function formatCop(n: number): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(n);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildReceiptHtml(r: Receipt): string {
  // Mantenemos fidelidad con `ReceiptCard` del front (paleta índigo/cian).
  // CSS print-friendly incluido (oculta acciones, agranda el monto).
  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Recibo ${escapeHtml(r.codigo)}</title>
  <style>
    :root {
      --primary: #4f46e5;
      --accent: #06b6d4;
      --muted: #f4f4f5;
      --text: #18181b;
      --muted-fg: #71717a;
      --border: #e4e4e7;
    }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; background: #fafafa; color: var(--text); font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
    .wrap { max-width: 480px; margin: 0 auto; padding: 24px 16px; }
    .card { background: white; border: 1px solid var(--border); border-radius: 16px; overflow: hidden; }
    .header { padding: 24px 24px 8px; text-align: center; }
    .header .kicker { font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted-fg); }
    .header .code { font-size: 22px; font-weight: 700; margin-top: 4px; font-variant-numeric: tabular-nums; }
    .amount { margin: 16px 24px; padding: 20px; border-radius: 12px; background: linear-gradient(135deg, rgba(79,70,229,0.08), rgba(6,182,212,0.08)); text-align: center; }
    .amount .kicker { font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted-fg); }
    .amount .value { font-size: 36px; font-weight: 700; margin-top: 4px; font-variant-numeric: tabular-nums; }
    dl { padding: 8px 24px; display: grid; grid-template-columns: 1fr 1fr; gap: 12px 16px; margin: 0; }
    dl .k { font-size: 11px; letter-spacing: 0.06em; text-transform: uppercase; color: var(--muted-fg); margin-bottom: 2px; }
    dl .v { font-size: 14px; font-weight: 500; font-variant-numeric: tabular-nums; }
    .balance { grid-column: 1 / -1; padding: 12px; border: 1px solid var(--border); border-radius: 8px; margin-top: 8px; }
    .balance .v { font-size: 20px; font-weight: 700; }
    .actions { padding: 16px 24px 24px; display: flex; flex-direction: column; gap: 8px; }
    .actions a, .actions button { display: block; text-align: center; padding: 12px 16px; border-radius: 8px; font-size: 14px; font-weight: 500; text-decoration: none; border: 0; cursor: pointer; }
    .btn-primary { background: var(--primary); color: white; }
    .btn-secondary { background: var(--muted); color: var(--text); }
    @media print {
      .actions { display: none; }
      .wrap { padding: 0; }
      .card { border: 0; box-shadow: none; }
      body { background: white; }
      .amount .value { font-size: 42px; }
    }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="card">
      <div class="header">
        <p class="kicker">Recibo de pago</p>
        <p class="code">${escapeHtml(r.codigo)}</p>
      </div>

      <div class="amount">
        <p class="kicker">Monto pagado</p>
        <p class="value">${escapeHtml(formatCop(r.monto))}</p>
      </div>

      <dl>
        <div>
          <p class="k">Cliente</p>
          <p class="v">${escapeHtml(r.credito.clienteNombre)}</p>
        </div>
        <div>
          <p class="k">Producto</p>
          <p class="v">${escapeHtml(r.credito.productoNombre)}</p>
        </div>
        <div>
          <p class="k">Crédito</p>
          <p class="v">${escapeHtml(r.credito.codigo)}</p>
        </div>
        <div>
          <p class="k">Fecha</p>
          <p class="v">${escapeHtml(formatDate(r.fecha))}</p>
        </div>
        <div class="balance">
          <p class="k">Saldo restante</p>
          <p class="v">${escapeHtml(formatCop(r.saldoRestante))}</p>
        </div>
      </dl>

      <div class="actions">
        <a class="btn-primary" href="#" onclick="window.print(); return false;">Imprimir / Guardar PDF</a>
      </div>
    </div>
  </div>
</body>
</html>`;
}

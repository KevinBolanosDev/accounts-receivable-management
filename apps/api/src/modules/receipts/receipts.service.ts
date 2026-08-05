import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type { Receipt } from "@repo/types";

import type { AuthenticatedUser } from "../../core/auth/auth-request";
import { requireAdminId } from "../../core/auth/tenant.util";
import { buildReciboCodigo } from "../../core/domain/receipt-code.util";
import { PrismaService } from "../../core/prisma/prisma.service";
import { ReceiptTokenService } from "../../core/receipts/receipt-token.service";

type PagoAccessRow = {
  credito: {
    clienteId: string;
    // Explícito en el propio Credito (ver `schema.prisma`): un cliente puede
    // ser cartera de más de un admin, así que el tenant NO se puede derivar
    // de `cliente`.
    adminId: string;
    cliente: {
      // Todas las relaciones cliente↔admin de este cliente (normalmente 1).
      // Se resuelve la que corresponde a `credito.adminId` en `assertAccess`
      // — no se puede filtrar en la query porque ese valor es un campo
      // hermano dentro del mismo resultado, no algo conocido de antemano.
      admins: { adminId: string; ruta: { cobradorId: string | null } | null }[];
    };
  };
};

// Servicio del módulo `receipts` (Fase 4). No tiene repository propio —
// `Receipt` es un view-model agregado sobre `Pago` + `Credito` + `Cliente`
// + `Producto` + `Usuario`. La capa de datos la maneja Prisma directo
// porque el feature es de solo lectura y no comparte modelo con otros.
//
// Sirve a DOS consumidores con scoping distinto: el staff vía
// `GET /payments/:pagoId/receipt` (`ReceiptsController`) y el cliente vía
// `GET /client-portal/payments/:pagoId/receipt` (`ClientPortalController`,
// que inyecta este mismo service — no duplica la plantilla HTML).
@Injectable()
export class ReceiptsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly receiptToken: ReceiptTokenService,
  ) {}

  // Construye el shape `Receipt` para un pago existente. Lanza 404 si el
  // pago no existe (o si es de otro cliente — ver `assertAccess`) y 403 si
  // es un COBRADOR pidiendo un pago de una ruta ajena.
  async getReceipt(pagoId: string, user: AuthenticatedUser): Promise<Receipt> {
    return this.loadReceipt(pagoId, user);
  }

  // Variante SIN chequeo de rol, para el enlace público firmado (`GET /r/:token`).
  // La autorización ya la hizo `ReceiptTokenService.verify`: el token es la
  // capability. No exponer este método a ningún controller autenticado.
  async getPublicReceiptHtml(pagoId: string): Promise<string> {
    return buildReceiptHtml(await this.loadReceipt(pagoId, null));
  }

  // `user === null` ⇒ acceso ya autorizado por token firmado.
  private async loadReceipt(pagoId: string, user: AuthenticatedUser | null): Promise<Receipt> {
    const pago = await this.prisma.pago.findUnique({
      where: { id: pagoId },
      include: {
        credito: {
          include: {
            cliente: {
              select: {
                nombre: true,
                telefono: true,
                admins: { select: { adminId: true, ruta: { select: { cobradorId: true } } } },
              },
            },
            producto: { select: { nombre: true } },
          },
        },
        cobrador: { select: { nombre: true } },
      },
    });
    if (!pago) {
      throw new NotFoundException("Pago no encontrado.");
    }

    if (user) {
      this.assertAccess(pago, user);
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
      codigo: buildReciboCodigo(pago.id),
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
      // El HTML server-rendered no los usa (trae su propio botón "Imprimir" y
      // ya se abre desde el link firmado): calcularlos siempre es más simple
      // que ramificar por consumidor, y firmar un JWT sin I/O es barato.
      reciboPublicUrl: this.receiptToken.buildPublicUrl(pago.id),
      clienteTelefono: pago.credito.cliente.telefono,
      anulado: pago.anulado,
    };
  }

  // Construye el HTML server-rendered del recibo. Es un documento STANDALONE:
  // CSS inline, sin Tailwind, sin necesidad del SPA. Diseñado para abrirse
  // directamente desde WhatsApp sin autenticación (futuro público) — hoy
  // protegido por JWT (staff o cliente, según el controller que lo invoque).
  async getReceiptHtml(pagoId: string, user: AuthenticatedUser): Promise<string> {
    const receipt = await this.getReceipt(pagoId, user);
    return buildReceiptHtml(receipt);
  }

  // Scoping por rol (hallazgo de revisión de Fase 4.0-4.10: antes no existía
  // ningún chequeo, cualquier autenticado veía cualquier recibo):
  // - ADMIN: sin restricción.
  // - COBRADOR: solo recibos de clientes de SU ruta (mismo criterio que
  //   `cobros.service.ts:43` / `creditos.service.ts:61`).
  // - CLIENTE: solo recibos de SUS PROPIOS pagos — 404 genérico (no 403) para
  //   no revelar que el pago existe si es de otro cliente.
  private assertAccess(pago: PagoAccessRow, user: AuthenticatedUser): void {
    // CLIENTE no tiene tenant (se scopea por su propio id) — se resuelve aparte.
    if (user.rol === "CLIENTE") {
      if (pago.credito.clienteId !== user.sub) {
        throw new NotFoundException("Pago no encontrado.");
      }
      return;
    }

    // Staff: primero el tenant. Un recibo de otro admin no existe — 404, no
    // 403, para no confirmar que ese pago existe en otra cartera.
    if (pago.credito.adminId !== requireAdminId(user)) {
      throw new NotFoundException("Pago no encontrado.");
    }

    if (user.rol === "ADMIN") return;

    // La relación cliente↔admin correspondiente a ESTE crédito (el cliente
    // puede tener otras, con otros admins — no sirven acá).
    const relation = pago.credito.cliente.admins.find((a) => a.adminId === pago.credito.adminId);
    if (relation?.ruta?.cobradorId !== user.sub) {
      throw new ForbiddenException("Solo puedes ver recibos de clientes de tus rutas.");
    }
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

// Fecha CON hora: un cobrador puede registrar varios pagos del mismo cliente
// el mismo día, y sin la hora los recibos son indistinguibles entre sí.
// `timeZone` fijo: el server corre en UTC y sin esto el recibo mostraría una
// hora distinta a la que ve el cobrador en pantalla.
function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("es-CO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Bogota",
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
    .void-banner { margin: 16px 24px 0; padding: 10px 12px; border-radius: 8px; background: #fef2f2; color: #b91c1c; font-size: 13px; font-weight: 600; text-align: center; }
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
      ${r.anulado ? '<p class="void-banner">Este pago fue ANULADO — no cuenta como abono al crédito.</p>' : ""}
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

import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type {
  CreateCreditoRequest,
  Credito,
  CreditoDetail,
  CreditoListItem,
  CreditosQuery,
  EstadoCredito,
  UpdateCreditoRequest,
} from "@repo/types";

import { PrismaService } from "../../core/prisma/prisma.service";
import type { AuthenticatedUser } from "../../core/auth/auth-request";
import { requireAdminId } from "../../core/auth/tenant.util";

import {
  CreditosRepository,
  type CreditoWithDetail,
  type CreditoWithProducto,
} from "./creditos.repository";

const ESTADOS_VALIDOS: EstadoCredito[] = ["ACTIVO", "PAGADO", "MORA", "ANULADO"];

@Injectable()
export class CreditosService {
  constructor(
    private readonly creditosRepository: CreditosRepository,
    private readonly prisma: PrismaService,
  ) {}

  async findAll(user: AuthenticatedUser, query: CreditosQuery): Promise<CreditoListItem[]> {
    const where = this.scopedWhereForCreditos(user, query);
    const rows = await this.creditosRepository.findMany(where);
    return rows.map((row) => toListItem(row));
  }

  async findOne(id: string, user: AuthenticatedUser): Promise<CreditoDetail> {
    const adminId = requireAdminId(user);
    const where = this.scopedWhereByCliente(user);
    const row = await this.creditosRepository.findById(id, where, adminId);
    if (!row) throw new NotFoundException("Crédito no encontrado.");
    return toDetail(row);
  }

  async create(body: CreateCreditoRequest, user: AuthenticatedUser): Promise<Credito> {
    const adminId = requireAdminId(user);

    // 1. Verificar que el cliente existe Y está asignado a ESTE admin (fila
    // ClientAdmin), con su ruta EN ESE tenant para el scoping por cobrador.
    // Un cliente sin relación con este admin (inexistente, o cartera de OTRO
    // admin) se reporta como inexistente, no como prohibido — y tampoco
    // alcanza a crear el crédito: es exactamente el gate de "un cliente
    // compartido solo es cartera de un admin si tiene la fila de unión".
    const cliente = await this.prisma.cliente.findFirst({
      where: { id: body.clienteId, admins: { some: { adminId } } },
      include: {
        admins: {
          where: { adminId },
          take: 1,
          select: { ruta: { select: { id: true, cobradorId: true } } },
        },
      },
    });
    if (!cliente) {
      throw new NotFoundException("El cliente no existe.");
    }
    const clientRelation = cliente.admins[0];

    // 2. Scoping por cobrador. Un cliente "sin ruta" (§3 — cierre de Fase 3)
    // no tiene cobrador asignado, así que ningún COBRADOR pasa.
    if (user.rol === "COBRADOR" && clientRelation?.ruta?.cobradorId !== user.sub) {
      throw new ForbiddenException("Solo puedes crear créditos para clientes de tus rutas.");
    }

    // 3. Producto (texto libre): se registra en el catálogo por nombre (upsert)
    // DENTRO del tenant. Si ya existe, se reutiliza (inventario, sin pisar su
    // precioBase); si es nuevo, se crea con precioBase = monto de esta venta.
    const producto = await this.upsertProducto(body.producto, body.monto, adminId);

    // 4. Derivar montos: montoTotal = monto + monto*interes/100; cuota = /dias.
    const { monto, interes, montoTotal, cuotaDiaria } = derivarMontos(
      body.monto,
      body.interes,
      body.dias,
    );

    // 5. Generar código desde la secuencia (race-safe).
    const codigo = await this.creditosRepository.nextCodigo();

    try {
      const created = await this.prisma.credito.create({
        data: {
          codigo,
          clienteId: body.clienteId,
          productoId: producto.id,
          adminId,
          monto,
          interes,
          dias: body.dias,
          montoTotal,
          cuotaDiaria,
          saldoPendiente: montoTotal,
          estado: "ACTIVO",
          fechaInicio: body.fechaInicio ? new Date(body.fechaInicio) : new Date(),
        },
        include: { producto: { select: { id: true, nombre: true } } },
      });
      return toListItem(created);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ConflictException("Conflicto generando código de crédito. Reintenta.");
      }
      throw error;
    }
  }

  async update(id: string, body: UpdateCreditoRequest, user: AuthenticatedUser): Promise<Credito> {
    const adminId = requireAdminId(user);
    const where = this.scopedWhereByCliente(user);
    const existing = await this.creditosRepository.findById(id, where, adminId);
    if (!existing) throw new NotFoundException("Crédito no encontrado.");

    if (existing.pagos.length > 0) {
      throw new ConflictException(
        "No puedes editar un crédito con pagos. Primero anúlalo si corresponde.",
      );
    }

    // Producto (texto libre): upsert por nombre si viene.
    let productoId: string | undefined;
    if (body.producto !== undefined) {
      const producto = await this.upsertProducto(
        body.producto,
        body.monto ?? existing.monto,
        requireAdminId(user),
      );
      productoId = producto.id;
    }

    // Recalcular montos si cambió monto/interes/dias. Como el crédito no tiene
    // pagos (validado arriba), es seguro reasignar saldoPendiente = montoTotal.
    const recalcular =
      body.monto !== undefined || body.interes !== undefined || body.dias !== undefined;
    const derivados = recalcular
      ? derivarMontos(
          body.monto ?? decimalToNumber(existing.monto),
          body.interes ?? decimalToNumber(existing.interes),
          body.dias ?? existing.dias,
        )
      : undefined;

    const updated = await this.prisma.credito.update({
      where: { id },
      data: {
        producto: productoId ? { connect: { id: productoId } } : undefined,
        monto: body.monto !== undefined ? new Prisma.Decimal(body.monto) : undefined,
        interes: body.interes !== undefined ? new Prisma.Decimal(body.interes) : undefined,
        dias: body.dias !== undefined ? body.dias : undefined,
        montoTotal: derivados?.montoTotal,
        cuotaDiaria: derivados?.cuotaDiaria,
        saldoPendiente: derivados?.montoTotal,
      },
      include: { producto: { select: { id: true, nombre: true } } },
    });

    return toListItem(updated);
  }

  async anular(id: string, user: AuthenticatedUser): Promise<Credito> {
    // ADMIN only — el controller aplica @Roles("ADMIN"). Aquí exigimos que el
    // crédito exista DENTRO de su tenant (sin el scope, un ADMIN podía anular
    // el crédito de otro ADMIN) y lo marcamos ANULADO, conservando todos los
    // pagos (auditable: dinero no se borra).
    const existing = await this.creditosRepository.findById(
      id,
      this.scopedWhereByCliente(user),
      requireAdminId(user),
    );
    if (!existing) throw new NotFoundException("Crédito no encontrado.");

    const updated = await this.prisma.credito.update({
      where: { id },
      data: { estado: "ANULADO" },
      include: { producto: { select: { id: true, nombre: true } } },
    });

    return toListItem(updated);
  }

  // Registra un producto por nombre (texto libre). Idempotente: si existe se
  // reutiliza sin pisar su precioBase; si es nuevo, precioBase = monto de la
  // venta. Es la pieza que mantiene el "inventario" pese al campo libre.
  private upsertProducto(
    nombre: string,
    montoReferencia: number | Prisma.Decimal,
    adminId: string,
  ): Promise<{ id: string }> {
    const nombreNormalizado = nombre.trim();
    return this.prisma.producto.upsert({
      // Clave compuesta: el catálogo es por tenant, así que "Nevera" del admin
      // A y "Nevera" del admin B son dos filas distintas.
      where: { adminId_nombre: { adminId, nombre: nombreNormalizado } },
      update: { activo: true },
      create: {
        nombre: nombreNormalizado,
        precioBase: new Prisma.Decimal(montoReferencia),
        activo: true,
        adminId,
      },
      select: { id: true },
    });
  }

  /**
   * Restringe el `where` para listar/buscar créditos según el usuario.
   *
   * `Credito.adminId` es explícito (ver el comentario en `schema.prisma`):
   * un cliente puede ser cartera de más de un admin, así que el tenant del
   * crédito NO se puede derivar de `cliente.adminId` — cada Credito lleva el
   * suyo propio, stampeado al crearlo.
   */
  private scopedWhereForCreditos(
    user: AuthenticatedUser,
    query: CreditosQuery,
  ): Prisma.CreditoWhereInput {
    return {
      ...(query.estado && ESTADOS_VALIDOS.includes(query.estado) ? { estado: query.estado } : {}),
      ...(query.clienteId ? { clienteId: query.clienteId } : {}),
      ...this.scopedWhereByCliente(user),
    };
  }

  private scopedWhereByCliente(user: AuthenticatedUser): Prisma.CreditoWhereInput {
    const adminId = requireAdminId(user);
    return {
      adminId,
      // El scoping por cobrador sigue viajando a través del cliente: la ruta
      // es propiedad de la relación cliente↔admin (`ClientAdmin`), filtrada a
      // la fila de ESTE admin (coincide con el `adminId` de arriba, así que
      // apunta siempre a la relación correcta aunque el cliente sea cartera
      // compartida).
      ...(user.rol === "COBRADOR"
        ? { cliente: { admins: { some: { adminId, ruta: { cobradorId: user.sub } } } } }
        : {}),
    };
  }
}

// === Cálculo de montos (dinero en Decimal, nunca Float) =====================
// montoTotal = monto + monto*interes/100 ; cuotaDiaria = montoTotal/dias.
// Ej: 200000 capital, 40% → interés 80000 → total 280000 → /30 = 9333.33.
function derivarMontos(
  montoNum: number,
  interesNum: number,
  dias: number,
): {
  monto: Prisma.Decimal;
  interes: Prisma.Decimal;
  montoTotal: Prisma.Decimal;
  cuotaDiaria: Prisma.Decimal;
} {
  const monto = new Prisma.Decimal(montoNum);
  const interes = new Prisma.Decimal(interesNum);
  const interesTotal = monto.mul(interes).div(100);
  const montoTotal = monto.add(interesTotal).toDecimalPlaces(2);
  const cuotaDiaria = dias > 0 ? montoTotal.div(dias).toDecimalPlaces(2) : new Prisma.Decimal(0);
  return { monto, interes, montoTotal, cuotaDiaria };
}

// === toDto: Decimal → number, Date → ISO string ============================

function decimalToNumber(d: Prisma.Decimal): number {
  return Number(d.toString());
}

function toListItem(row: CreditoWithProducto): CreditoListItem {
  const monto = decimalToNumber(row.monto);
  const interes = decimalToNumber(row.interes);
  const montoTotal = decimalToNumber(row.montoTotal);
  const saldoPendiente = decimalToNumber(row.saldoPendiente);
  const totalPagado = Number((montoTotal - saldoPendiente).toFixed(2));
  const porcentajePagado =
    montoTotal > 0 ? Number(((totalPagado / montoTotal) * 100).toFixed(2)) : 0;
  const cuotaDiaria = decimalToNumber(row.cuotaDiaria);
  const cuotasTotal = row.dias;
  const cuotasPagadas =
    cuotaDiaria > 0 ? Math.min(row.dias, Math.round(totalPagado / cuotaDiaria)) : 0;

  return {
    id: row.id,
    codigo: row.codigo,
    clienteId: row.clienteId,
    producto: row.producto.nombre,
    monto,
    interes,
    dias: row.dias,
    montoTotal,
    cuotaDiaria,
    saldoPendiente,
    totalPagado,
    porcentajePagado,
    estado: row.estado,
    fechaInicio: row.fechaInicio.toISOString(),
    cuotasPagadas,
    cuotasTotal,
  };
}

function toDetail(row: CreditoWithDetail): CreditoDetail {
  return {
    ...toListItem(row),
    cliente: {
      id: row.cliente.id,
      nombre: row.cliente.nombre,
      // La única fila de `admins` presente es la de ESTE crédito (el include
      // la filtra por `adminId` — ver `creditos.repository.ts`).
      ruta: row.cliente.admins[0]?.ruta
        ? { id: row.cliente.admins[0].ruta.id, nombre: row.cliente.admins[0].ruta.nombre }
        : null,
    },
    pagos: row.pagos.map((p) => ({
      id: p.id,
      creditoId: p.creditoId,
      monto: decimalToNumber(p.monto),
      fecha: p.fecha.toISOString(),
      cobradorId: p.cobradorId,
      cobradorNombre: p.cobrador?.nombre ?? null,
      reciboUrl: p.reciboUrl ?? null,
    })),
  };
}

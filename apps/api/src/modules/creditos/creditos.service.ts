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
    const where = this.scopedWhereByCliente(user);
    const row = await this.creditosRepository.findById(id, where);
    if (!row) throw new NotFoundException("Crédito no encontrado.");
    return toDetail(row);
  }

  async create(body: CreateCreditoRequest, user: AuthenticatedUser): Promise<Credito> {
    // 1. Verificar que el cliente existe (con su ruta, para el scoping).
    const cliente = await this.prisma.cliente.findUnique({
      where: { id: body.clienteId },
      include: { ruta: { select: { id: true, cobradorId: true } } },
    });
    if (!cliente) {
      throw new NotFoundException("El cliente no existe.");
    }

    // 2. Scoping por cobrador.
    if (user.rol === "COBRADOR" && cliente.ruta.cobradorId !== user.sub) {
      throw new ForbiddenException("Solo puedes crear créditos para clientes de tus rutas.");
    }

    // 3. Producto (texto libre): se registra en el catálogo por nombre (upsert).
    // Si ya existe, se reutiliza (inventario, sin pisar su precioBase); si es
    // nuevo, se crea con precioBase = monto de esta venta.
    const producto = await this.upsertProducto(body.producto, body.monto);

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
    const where = this.scopedWhereByCliente(user);
    const existing = await this.creditosRepository.findById(id, where);
    if (!existing) throw new NotFoundException("Crédito no encontrado.");

    if (existing.pagos.length > 0) {
      throw new ConflictException(
        "No puedes editar un crédito con pagos. Primero anúlalo si corresponde.",
      );
    }

    // Producto (texto libre): upsert por nombre si viene.
    let productoId: string | undefined;
    if (body.producto !== undefined) {
      const producto = await this.upsertProducto(body.producto, body.monto ?? existing.monto);
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

  async anular(id: string): Promise<Credito> {
    // ADMIN only — el controller aplica @Roles("ADMIN"). Aquí exigimos que el
    // crédito exista y lo marcamos ANULADO, conservando todos los pagos
    // (auditable: dinero no se borra).
    const existing = await this.creditosRepository.findById(id);
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
  ): Promise<{ id: string }> {
    const nombreNormalizado = nombre.trim();
    return this.prisma.producto.upsert({
      where: { nombre: nombreNormalizado },
      update: { activo: true },
      create: {
        nombre: nombreNormalizado,
        precioBase: new Prisma.Decimal(montoReferencia),
        activo: true,
      },
      select: { id: true },
    });
  }

  /**
   * Restringe el `where` para listar/buscar créditos según el rol del usuario.
   * ADMIN: sin scoping extra. COBRADOR: cliente.ruta.cobradorId = user.sub.
   */
  private scopedWhereForCreditos(
    user: AuthenticatedUser,
    query: CreditosQuery,
  ): Prisma.CreditoWhereInput {
    const where: Prisma.CreditoWhereInput = {
      ...(query.estado && ESTADOS_VALIDOS.includes(query.estado) ? { estado: query.estado } : {}),
      ...(query.clienteId ? { clienteId: query.clienteId } : {}),
    };
    if (user.rol === "ADMIN") return where;
    return {
      ...where,
      cliente: { ruta: { cobradorId: user.sub } },
    };
  }

  private scopedWhereByCliente(user: AuthenticatedUser): Prisma.CreditoWhereInput {
    if (user.rol === "ADMIN") return {};
    return { cliente: { ruta: { cobradorId: user.sub } } };
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
      ruta: row.cliente.ruta ? { id: row.cliente.ruta.id, nombre: row.cliente.ruta.nombre } : null,
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

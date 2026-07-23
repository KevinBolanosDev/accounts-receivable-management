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
    const hoy = new Date();
    return rows.map((row) => toListItem(row, hoy));
  }

  async findOne(id: string, user: AuthenticatedUser): Promise<CreditoDetail> {
    const where = this.scopedWhereByCliente(user);
    const row = await this.creditosRepository.findById(id, where);
    if (!row) throw new NotFoundException("Crédito no encontrado.");

    const hoy = new Date();
    return toDetail(row, hoy);
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
    if (user.rol === "COBRADOR") {
      if (cliente.ruta.cobradorId !== user.sub) {
        throw new ForbiddenException("Solo puedes crear créditos para clientes de tus rutas.");
      }
    }

    // 3. Producto debe existir y estar activo.
    const producto = await this.prisma.producto.findUnique({ where: { id: body.productoId } });
    if (!producto || !producto.activo) {
      throw new NotFoundException("El producto no existe o está inactivo.");
    }

    // 4. Generar código desde la secuencia (race-safe).
    const codigo = await this.creditosRepository.nextCodigo();

    const montoTotal = new Prisma.Decimal(body.montoTotal);
    const cuotaDiaria = new Prisma.Decimal(body.cuotaDiaria);

    try {
      const created = await this.prisma.credito.create({
        data: {
          codigo,
          clienteId: body.clienteId,
          productoId: body.productoId,
          montoTotal,
          cuotaDiaria,
          saldoPendiente: montoTotal,
          estado: "ACTIVO",
          fechaInicio: body.fechaInicio ? new Date(body.fechaInicio) : new Date(),
        },
        include: { producto: { select: { id: true, nombre: true } } },
      });
      const hoy = new Date();
      return toListItem(created, hoy);
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

    if (body.productoId) {
      const producto = await this.prisma.producto.findUnique({ where: { id: body.productoId } });
      if (!producto || !producto.activo) {
        throw new NotFoundException("El producto no existe o está inactivo.");
      }
    }

    const updated = await this.prisma.credito.update({
      where: { id },
      data: {
        producto: body.productoId ? { connect: { id: body.productoId } } : undefined,
        montoTotal: body.montoTotal !== undefined ? new Prisma.Decimal(body.montoTotal) : undefined,
        cuotaDiaria:
          body.cuotaDiaria !== undefined ? new Prisma.Decimal(body.cuotaDiaria) : undefined,
      },
      include: { producto: { select: { id: true, nombre: true } } },
    });

    const hoy = new Date();
    return toListItem(updated, hoy);
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

    const hoy = new Date();
    return toListItem(updated, hoy);
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

// toDto: Decimal → number en el borde, fecha → ISO string. Nunca `Float` para
// dinero: el backend trabaja con `Decimal` y nosotros hacemos `.toNumber()`
// indirecto (vía `.toString()` para no perder precisión en el casteo).

function decimalToNumber(d: Prisma.Decimal): number {
  return Number(d.toString());
}

function toListItem(row: CreditoWithProducto, _hoy: Date): CreditoListItem {
  const montoTotal = decimalToNumber(row.montoTotal);
  const saldoPendiente = decimalToNumber(row.saldoPendiente);
  const totalPagado = Number((montoTotal - saldoPendiente).toFixed(2));
  const porcentajePagado =
    montoTotal > 0 ? Number((((montoTotal - saldoPendiente) / montoTotal) * 100).toFixed(2)) : 0;
  const cuotaDiaria = decimalToNumber(row.cuotaDiaria);
  const cuotasTotal = cuotaDiaria > 0 ? Math.ceil(montoTotal / cuotaDiaria) : 0;
  const cuotasPagadas = cuotaDiaria > 0 ? Math.round(totalPagado / cuotaDiaria) : 0;

  return {
    id: row.id,
    codigo: row.codigo,
    clienteId: row.clienteId,
    productoId: row.productoId,
    montoTotal,
    cuotaDiaria,
    saldoPendiente,
    totalPagado,
    porcentajePagado,
    estado: row.estado,
    fechaInicio: row.fechaInicio.toISOString(),
    producto: { id: row.producto.id, nombre: row.producto.nombre },
    cuotasPagadas,
    cuotasTotal,
  };
}

function toDetail(row: CreditoWithDetail, hoy: Date): CreditoDetail {
  return {
    ...toListItem(row, hoy),
    cliente: { id: row.cliente.id, nombre: row.cliente.nombre },
    pagos: row.pagos.map((p) => ({
      id: p.id,
      creditoId: p.creditoId,
      monto: decimalToNumber(p.monto),
      fecha: p.fecha.toISOString(),
      cobradorId: p.cobradorId,
      reciboUrl: p.reciboUrl ?? null,
    })),
  };
}

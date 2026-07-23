import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { randomBytes } from "node:crypto";
import type {
  ClienteDetail,
  ClienteListItem,
  ClientesQuery,
  CreditoListItem,
  CreateClienteRequest,
  EstadoCliente,
  UpdateClienteRequest,
} from "@repo/types";

import type { AuthenticatedUser } from "../../core/auth/auth-request";
import {
  ClientsRepository,
  type ClientWithDetail,
  type ClientWithRoute,
} from "./clients.repository";

@Injectable()
export class ClientsService {
  constructor(private readonly clientsRepository: ClientsRepository) {}

  async findAll(user: AuthenticatedUser, query: ClientesQuery): Promise<ClienteListItem[]> {
    const clients = await this.clientsRepository.findMany(this.scopedWhere(user, query));
    return clients.map((client) => this.toListItem(client));
  }

  async findOne(id: string, user: AuthenticatedUser): Promise<ClienteDetail> {
    const client = await this.clientsRepository.findById(id, this.scopeWhere(user));
    if (!client) throw new NotFoundException("Cliente no encontrado.");
    return this.toDetail(client);
  }

  async create(body: CreateClienteRequest, user: AuthenticatedUser): Promise<ClienteDetail> {
    await this.assertRouteAccess(body.rutaId, user);

    try {
      const client = await this.clientsRepository.create({
        nombre: body.nombre,
        telefono: body.telefono,
        documento: body.documento,
        direccion: body.direccion,
        ruta: { connect: { id: body.rutaId } },
        fotoDocumentoFrenteUrl: body.fotoDocumentoFrenteUrl,
        fotoDocumentoReversoUrl: body.fotoDocumentoReversoUrl,
        tokenAcceso: randomBytes(32).toString("base64url"),
      });
      return this.toDetail(client);
    } catch (error) {
      throw this.mapError(error);
    }
  }

  async update(
    id: string,
    body: UpdateClienteRequest,
    user: AuthenticatedUser,
  ): Promise<ClienteDetail> {
    const existing = await this.clientsRepository.findById(id, this.scopeWhere(user));
    if (!existing) throw new NotFoundException("Cliente no encontrado.");

    if (body.rutaId !== undefined) {
      await this.assertRouteAccess(body.rutaId, user);
    }

    try {
      const client = await this.clientsRepository.update(id, {
        nombre: body.nombre,
        telefono: body.telefono,
        documento: body.documento,
        direccion: body.direccion,
        ruta: body.rutaId === undefined ? undefined : { connect: { id: body.rutaId } },
        fotoDocumentoFrenteUrl: body.fotoDocumentoFrenteUrl,
        fotoDocumentoReversoUrl: body.fotoDocumentoReversoUrl,
      });
      return this.toDetail(client);
    } catch (error) {
      throw this.mapError(error);
    }
  }

  async remove(id: string): Promise<void> {
    const client = await this.clientsRepository.findById(id);
    if (!client) throw new NotFoundException("Cliente no encontrado.");
    await this.clientsRepository.update(id, { activo: false });
  }

  private scopeWhere(user: AuthenticatedUser): Prisma.ClienteWhereInput {
    return {
      activo: true,
      ...(user.rol === "COBRADOR" ? { ruta: { cobradorId: user.sub } } : {}),
    };
  }

  private scopedWhere(user: AuthenticatedUser, query: ClientesQuery): Prisma.ClienteWhereInput {
    return {
      ...this.scopeWhere(user),
      ...(query.rutaId ? { rutaId: query.rutaId } : {}),
      ...(query.search
        ? {
            OR: [
              { nombre: { contains: query.search, mode: "insensitive" } },
              { documento: { contains: query.search, mode: "insensitive" } },
            ],
          }
        : {}),
    };
  }

  private async assertRouteAccess(rutaId: string, user: AuthenticatedUser): Promise<void> {
    const route = await this.clientsRepository.findRouteById(rutaId);
    if (!route) throw new NotFoundException("La ruta no existe.");
    if (user.rol === "COBRADOR" && route.cobradorId !== user.sub) {
      throw new ForbiddenException("No puedes asignar clientes a una ruta ajena.");
    }
  }

  private mapError(error: unknown): Error {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return new ConflictException("Ya existe un cliente con ese documento.");
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return new NotFoundException("La ruta o el cliente no existe.");
    }
    return error as Error;
  }

  private toListItem(client: ClientWithRoute): ClienteListItem {
    return {
      id: client.id,
      nombre: client.nombre,
      telefono: client.telefono,
      documento: client.documento,
      direccion: client.direccion,
      fotoDocumentoFrenteUrl: client.fotoDocumentoFrenteUrl,
      fotoDocumentoReversoUrl: client.fotoDocumentoReversoUrl,
      rutaId: client.rutaId,
      ruta: client.ruta ? { id: client.ruta.id, nombre: client.ruta.nombre } : null,
    };
  }

  private toDetail(client: ClientWithDetail): ClienteDetail {
    // Fase 3 — el detalle del cliente lleva agregados de crédito. Calculamos
    // saldoPendiente/porcentajePagado/estado aquí (no en Prisma) a partir de
    // los créditos ya materializados. La separación Activos vs Historial sale
    // del estado del crédito (ACTIVO/MORA en Activos; PAGADO/ANULADO en
    // Historial). El rollup `estado` (mora/activo/pagado/proximo-a-vencer)
    // se deriva aquí también.
    const hoy = new Date();

    const creditosActivos: CreditoListItem[] = [];
    const creditosHistorial: CreditoListItem[] = [];
    for (const c of client.creditos) {
      const item = mapCreditoListItem(c);
      if (item.estado === "ACTIVO" || item.estado === "MORA") {
        creditosActivos.push(item);
      } else {
        creditosHistorial.push(item);
      }
    }

    const saldoActivos = creditosActivos.reduce((sum, c) => sum + c.saldoPendiente, 0);
    const totalPagadoActivos = creditosActivos.reduce((sum, c) => sum + c.totalPagado, 0);
    const montoTotalActivos = creditosActivos.reduce((sum, c) => sum + c.montoTotal, 0);
    const porcentajePagado =
      montoTotalActivos > 0
        ? Number(((totalPagadoActivos / montoTotalActivos) * 100).toFixed(2))
        : 0;

    const estado: EstadoCliente = rollupEstado({
      creditosActivos,
      creditosHistorial,
      hoy,
      cuotaSugerida: creditosActivos[0]?.cuotaDiaria ?? 0,
    });

    const listItem: ClienteListItem = {
      ...this.toListItem(client),
      saldoPendiente: Number(saldoActivos.toFixed(2)),
      porcentajePagado,
      estado,
    };

    return {
      ...listItem,
      cobradorNombre: client.ruta.cobrador?.nombre ?? null,
      estado,
      creditosActivos,
      creditosHistorial,
      historialPagos: client.creditos.flatMap((credito) =>
        credito.pagos.map((pago) => ({
          id: `client-${credito.id}-${pago.fecha.getTime()}-${pago.monto.toString()}`,
          creditoId: credito.id,
          monto: Number(pago.monto.toString()),
          fecha: pago.fecha.toISOString(),
          cobradorId: "(cobrador)",
          reciboUrl: null,
        })),
      ),
    };
  }
}

function mapCreditoListItem(c: ClientWithDetail["creditos"][number]): CreditoListItem {
  const montoTotal = Number(c.montoTotal.toString());
  const saldoPendiente = Number(c.saldoPendiente.toString());
  const totalPagado = Number((montoTotal - saldoPendiente).toFixed(2));
  const porcentajePagado =
    montoTotal > 0 ? Number(((totalPagado / montoTotal) * 100).toFixed(2)) : 0;
  const cuotaDiaria = Number(c.cuotaDiaria.toString());
  const cuotasTotal = cuotaDiaria > 0 ? Math.ceil(montoTotal / cuotaDiaria) : 0;
  const cuotasPagadas = cuotaDiaria > 0 ? Math.round(totalPagado / cuotaDiaria) : 0;

  return {
    id: c.id,
    codigo: c.codigo,
    clienteId: c.clienteId,
    productoId: c.productoId,
    montoTotal,
    cuotaDiaria,
    saldoPendiente,
    totalPagado,
    porcentajePagado,
    estado: c.estado,
    fechaInicio: c.fechaInicio.toISOString(),
    producto: { id: c.producto.id, nombre: c.producto.nombre },
    cuotasPagadas,
    cuotasTotal,
  };
}

// Rollup simple del estado del cliente (Fase 3 — definitivo se cierra en 5).
// Reglas:
//   - mora           → algún crédito activo está en MORA.
//   - proximo-a-vencer→ algún crédito activo y cuota que vence HOY.
//   - pagado          → sin créditos activos y al menos uno en historial pagado.
//   - activo          → en otro caso.
function rollupEstado(args: {
  creditosActivos: CreditoListItem[];
  creditosHistorial: CreditoListItem[];
  hoy: Date;
  cuotaSugerida: number;
}): EstadoCliente {
  const { creditosActivos, creditosHistorial, hoy, cuotaSugerida } = args;
  if (creditosActivos.some((c) => c.estado === "MORA")) return "mora";

  if (creditosActivos.length > 0 && cuotaSugerida > 0) {
    // "Próximo a vencer" si lo esperado a HOY supera a lo ya pagado del crédito
    // más antiguo (proxy: el de saldo más grande). Es provisional (Fase 5 lo
    // cierra con el cierre diario).
    const masAntiguo = [...creditosActivos].sort((a, b) =>
      a.fechaInicio.localeCompare(b.fechaInicio),
    )[0];
    if (masAntiguo) {
      const inicio = new Date(masAntiguo.fechaInicio);
      const diasTranscurridos = Math.max(
        0,
        Math.floor((hoy.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24)),
      );
      const esperado = diasTranscurridos * cuotaSugerida;
      const cuotaTolerada = cuotaSugerida * 1;
      if (esperado - masAntiguo.totalPagado > cuotaTolerada * 1.5) {
        return "proximo-a-vencer";
      }
    }
  }

  if (creditosActivos.length === 0 && creditosHistorial.some((c) => c.estado === "PAGADO")) {
    return "pagado";
  }

  return "activo";
}

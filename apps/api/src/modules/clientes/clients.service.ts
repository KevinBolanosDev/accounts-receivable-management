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
  ClientesSummary,
  CreditoListItem,
  CreateClienteRequest,
  EstadoCliente,
  UpdateClienteRequest,
} from "@repo/types";

import type { AuthenticatedUser } from "../../core/auth/auth-request";
import {
  mapCreditoListItem,
  rollupEstadoCliente,
  type CreditoRowForMapping,
} from "../../core/domain/credito-cliente.util";
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
    if (body.rutaId) {
      await this.assertRouteAccess(body.rutaId, user);
    }

    try {
      const client = await this.clientsRepository.create({
        nombre: body.nombre,
        telefono: body.telefono,
        documento: body.documento,
        direccion: body.direccion,
        ruta: body.rutaId ? { connect: { id: body.rutaId } } : undefined,
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

    // `rutaId` en el body: `undefined` = no tocar, `null` = quitar de su ruta
    // (queda "sin asignar"), string = (re)asignar a esa ruta.
    if (body.rutaId) {
      await this.assertRouteAccess(body.rutaId, user);
    }

    try {
      const client = await this.clientsRepository.update(id, {
        nombre: body.nombre,
        telefono: body.telefono,
        documento: body.documento,
        direccion: body.direccion,
        ruta:
          body.rutaId === undefined
            ? undefined
            : body.rutaId === null
              ? { disconnect: true }
              : { connect: { id: body.rutaId } },
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

  // Métricas de la vista "Clientes" del Cobrador (clientes / cartera /
  // cobrados / saldo). Agrega sobre los créditos reales del cliente, scoped
  // igual que `findAll` (COBRADOR solo ve los suyos). Los créditos ANULADOS
  // no cuentan para la cartera ni el saldo.
  async summary(user: AuthenticatedUser): Promise<ClientesSummary> {
    const clients = await this.clientsRepository.findManyForSummary(this.scopeWhere(user));

    let cartera = 0;
    let saldo = 0;
    for (const client of clients) {
      for (const credito of client.creditos) {
        if (credito.estado === "ANULADO") continue;
        cartera += Number(credito.montoTotal.toString());
        saldo += Number(credito.saldoPendiente.toString());
      }
    }

    return {
      clientes: clients.length,
      cartera: Number(cartera.toFixed(2)),
      cobrados: Number((cartera - saldo).toFixed(2)),
      saldo: Number(saldo.toFixed(2)),
    };
  }

  private scopeWhere(user: AuthenticatedUser): Prisma.ClienteWhereInput {
    return {
      activo: true,
      // Igual que en rutas.service: una ruta desactivada no debe filtrar
      // clientes accesibles al cobrador por ningún camino (ni "Mis rutas" ni
      // "Clientes").
      ...(user.rol === "COBRADOR" ? { ruta: { cobradorId: user.sub, activa: true } } : {}),
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

  // Fase 3 — agregados de crédito compartidos por listado Y detalle. Antes
  // solo `toDetail` los calculaba; `toListItem` los dejaba `undefined`
  // (ningún listado — Admin "Clientes", cobrador "Mis clientes" — mostraba
  // saldo/estado/avance reales, aunque el include ya cargue los créditos).
  // La separación Activos vs Historial sale del estado del crédito
  // (ACTIVO/MORA en Activos; PAGADO/ANULADO en Historial).
  private computeAgregados(creditos: CreditoRowForMapping[]): {
    creditosActivos: CreditoListItem[];
    creditosHistorial: CreditoListItem[];
    saldoPendiente: number;
    porcentajePagado: number;
    estado: EstadoCliente;
  } {
    const creditosActivos: CreditoListItem[] = [];
    const creditosHistorial: CreditoListItem[] = [];
    for (const c of creditos) {
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

    const estado = rollupEstadoCliente({
      creditosActivos,
      creditosHistorial,
      hoy: new Date(),
      cuotaSugerida: creditosActivos[0]?.cuotaDiaria ?? 0,
    });

    return {
      creditosActivos,
      creditosHistorial,
      saldoPendiente: Number(saldoActivos.toFixed(2)),
      porcentajePagado,
      estado,
    };
  }

  private toListItem(client: ClientWithRoute): ClienteListItem {
    const agregados = this.computeAgregados(client.creditos);
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
      saldoPendiente: agregados.saldoPendiente,
      porcentajePagado: agregados.porcentajePagado,
      estado: agregados.estado,
    };
  }

  private toDetail(client: ClientWithDetail): ClienteDetail {
    const agregados = this.computeAgregados(client.creditos);

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
      saldoPendiente: agregados.saldoPendiente,
      porcentajePagado: agregados.porcentajePagado,
      estado: agregados.estado,
      cobradorNombre: client.ruta?.cobrador?.nombre ?? null,
      creditosActivos: agregados.creditosActivos,
      creditosHistorial: agregados.creditosHistorial,
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

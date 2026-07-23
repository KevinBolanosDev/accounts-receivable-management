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
  CreateClienteRequest,
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
    return {
      ...this.toListItem(client),
      cobradorNombre: client.ruta.cobrador?.nombre ?? null,
    };
  }
}

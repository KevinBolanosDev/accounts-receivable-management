import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { CreateRutaRequest, RutaDetail, RutaListItem, UpdateRutaRequest } from "@repo/types";

import type { AuthenticatedUser } from "../../core/auth/auth-request";
import { RutasRepository, type RutaWithCount, type RutaWithDetail } from "./rutas.repository";

// El scoping vive aquí, no en el repository: lee el rol/sub de @CurrentUser()
// y decide qué `where` le pasa al repo. El repo nunca ve al usuario autenticado.
@Injectable()
export class RutasService {
  constructor(private readonly rutasRepository: RutasRepository) {}

  async findAll(user: AuthenticatedUser): Promise<RutaListItem[]> {
    const where = this.scopeWhere(user);
    const rutas = await this.rutasRepository.findMany(where);
    return rutas.map((ruta) => this.toListItem(ruta));
  }

  async findOne(id: string, user: AuthenticatedUser): Promise<RutaDetail> {
    const where = this.scopeWhere(user);
    const ruta = await this.rutasRepository.findById(id, where);

    if (!ruta) {
      throw new NotFoundException("Ruta no encontrada.");
    }

    return this.toDetail(ruta);
  }

  async create(body: CreateRutaRequest): Promise<RutaListItem> {
    try {
      const ruta = await this.rutasRepository.create({
        nombre: body.nombre,
        activa: body.activa,
        cobrador: body.cobradorId ? { connect: { id: body.cobradorId } } : undefined,
      });
      return this.toListItem(ruta);
    } catch (error) {
      throw this.mapWriteError(error, { cobradorConnect: Boolean(body.cobradorId) });
    }
  }

  async update(id: string, body: UpdateRutaRequest): Promise<RutaListItem> {
    await this.assertExists(id);

    try {
      const ruta = await this.rutasRepository.update(id, {
        nombre: body.nombre,
        activa: body.activa,
        cobrador: this.cobradorUpdate(body.cobradorId),
      });
      return this.toListItem(ruta);
    } catch (error) {
      // Solo un `connect` a cobradorId puede fallar con "record not found" aquí;
      // si no se tocó cobrador, un P2025 solo puede ser la propia ruta (carrera
      // con un DELETE concurrente sobre el mismo id).
      throw this.mapWriteError(error, { cobradorConnect: typeof body.cobradorId === "string" });
    }
  }

  async remove(id: string): Promise<void> {
    await this.assertExists(id);

    const clientesCount = await this.rutasRepository.countClientes(id);
    if (clientesCount > 0) {
      throw new ConflictException(
        `No puedes eliminar esta ruta: tiene ${clientesCount} cliente(s) asignado(s). Reasígnalos primero o desactívala.`,
      );
    }

    try {
      await this.rutasRepository.delete(id);
    } catch (error) {
      throw this.mapDeleteError(error);
    }
  }

  private scopeWhere(user: AuthenticatedUser): Prisma.RutaWhereInput | undefined {
    return user.rol === "COBRADOR" ? { cobradorId: user.sub } : undefined;
  }

  private cobradorUpdate(
    cobradorId: string | null | undefined,
  ): Prisma.RutaUpdateInput["cobrador"] {
    if (cobradorId === undefined) return undefined;
    if (cobradorId === null) return { disconnect: true };
    return { connect: { id: cobradorId } };
  }

  private async assertExists(id: string): Promise<void> {
    const ruta = await this.rutasRepository.findById(id);
    if (!ruta) {
      throw new NotFoundException("Ruta no encontrada.");
    }
  }

  private mapWriteError(error: unknown, context: { cobradorConnect: boolean }): Error {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return new ConflictException("Ya existe una ruta con ese nombre.");
      }
      if (error.code === "P2025") {
        return context.cobradorConnect
          ? new BadRequestException("El cobrador indicado no existe.")
          : new NotFoundException("Ruta no encontrada.");
      }
    }
    return error as Error;
  }

  // Ventana de carrera entre assertExists()/countClientes() y el delete real
  // (dos round-trips sin transacción): otra petición pudo borrar la ruta
  // (P2025) o asignarle un cliente nuevo justo antes del delete, lo que la FK
  // `Cliente.ruta` (onDelete: Restrict) bloquea con P2003.
  private mapDeleteError(error: unknown): Error {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return new NotFoundException("Ruta no encontrada.");
      }
      if (error.code === "P2003") {
        return new ConflictException(
          "No puedes eliminar esta ruta: tiene clientes asignados. Reasígnalos primero o desactívala.",
        );
      }
    }
    return error as Error;
  }

  private toListItem(ruta: RutaWithCount): RutaListItem {
    return {
      id: ruta.id,
      nombre: ruta.nombre,
      activa: ruta.activa,
      cobradorId: ruta.cobradorId,
      cobrador: ruta.cobrador ? { id: ruta.cobrador.id, nombre: ruta.cobrador.nombre } : null,
      clientesCount: ruta._count.clientes,
      // Stub Fase 3/5: no hay Cobro/Cierre todavía.
      totalCobradoHoy: 0,
      avanceDelDia: 0,
      estadoDia: "abierta",
    };
  }

  private toDetail(ruta: RutaWithDetail): RutaDetail {
    return {
      ...this.toListItem(ruta),
      cobradorTelefono: ruta.cobrador?.telefono ?? null,
      // Stub Fase 3/5: no hay Cobro/Cierre todavía.
      cobradoHoy: 0,
      enMora: 0,
      saldoTotal: 0,
      cierres: [],
      clientes: ruta.clientes.map((cliente) => ({
        id: cliente.id,
        nombre: cliente.nombre,
        telefono: cliente.telefono,
        documento: cliente.documento,
        direccion: cliente.direccion,
        fotoDocumentoFrenteUrl: cliente.fotoDocumentoFrenteUrl,
        fotoDocumentoReversoUrl: cliente.fotoDocumentoReversoUrl,
        rutaId: cliente.rutaId,
        ruta: cliente.ruta ? { id: cliente.ruta.id, nombre: cliente.ruta.nombre } : null,
      })),
    };
  }
}

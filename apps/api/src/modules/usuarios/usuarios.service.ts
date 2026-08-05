import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import * as bcrypt from "bcrypt";
import type {
  CobradorListItem,
  CreateCobradorRequest,
  Rol,
  UpdateCobradorRequest,
} from "@repo/types";

import type { AuthenticatedUser } from "../../core/auth/auth-request";
import { requireAdminId } from "../../core/auth/tenant.util";
import { UsuariosRepository, type CobradorWithRelations } from "./usuarios.repository";

@Injectable()
export class UsuariosService {
  constructor(private readonly usuariosRepository: UsuariosRepository) {}

  async findAll(rol: Rol | undefined, user: AuthenticatedUser): Promise<CobradorListItem[]> {
    const usuarios = await this.usuariosRepository.findMany(this.scopeWhere(rol, user));
    return usuarios.map((usuario) => this.toListItem(usuario));
  }

  async create(body: CreateCobradorRequest, user: AuthenticatedUser): Promise<CobradorListItem> {
    const adminId = requireAdminId(user);

    try {
      const usuario = await this.usuariosRepository.create({
        nombre: body.nombre,
        telefono: body.telefono,
        documento: body.documento,
        passwordHash: await bcrypt.hash(body.password, 10),
        rol: "COBRADOR",
        // El cobrador nace colgado del admin que lo crea. Es lo que después
        // resuelve su tenant al loguearse (`resolveAdminId`).
        admin: { connect: { id: adminId } },
      });

      if (body.rutaId !== undefined) {
        await this.usuariosRepository.assignRoute(usuario.id, body.rutaId ?? null, adminId);
      }

      const result = await this.usuariosRepository.findById(usuario.id);
      if (!result) throw new NotFoundException("El cobrador no existe.");
      return this.toListItem(result);
    } catch (error) {
      throw this.mapError(error);
    }
  }

  async update(
    id: string,
    body: UpdateCobradorRequest,
    user: AuthenticatedUser,
  ): Promise<CobradorListItem> {
    const adminId = requireAdminId(user);
    // Scoped: un cobrador de otro admin no existe para este admin.
    const existing = await this.usuariosRepository.findById(id, { adminId });
    if (!existing || existing.rol !== "COBRADOR") {
      throw new NotFoundException("Cobrador no encontrado.");
    }

    try {
      await this.usuariosRepository.update(id, {
        nombre: body.nombre,
        telefono: body.telefono,
        activo: body.activo,
      });

      if (body.rutaId !== undefined) {
        await this.usuariosRepository.assignRoute(id, body.rutaId, adminId);
      }

      const result = await this.usuariosRepository.findById(id);
      if (!result) throw new NotFoundException("Cobrador no encontrado.");
      return this.toListItem(result);
    } catch (error) {
      throw this.mapError(error);
    }
  }

  // Baja de un cobrador: `activo: false` + sus rutas quedan sin cobrador.
  //
  // NO es un borrado físico: `Pago.cobradorId` es `onDelete: Restrict`, así que
  // un cobrador con pagos registrados no se puede borrar sin perder el rastro
  // de quién cobró qué. La baja lógica conserva la auditoría y, junto con el
  // filtro `activo` del login, le cierra el acceso de verdad.
  async remove(id: string, user: AuthenticatedUser): Promise<void> {
    const adminId = requireAdminId(user);

    // Antes del check de tenant: el paso siguiente también lo bloquearía (un
    // ADMIN nunca cumple `rol === "COBRADOR"`), pero respondería 404, que para
    // "intentaste eliminarte a ti mismo" es desconcertante.
    if (id === user.sub) {
      throw new ForbiddenException("No puedes eliminar tu propio usuario.");
    }

    const existing = await this.usuariosRepository.findById(id, { adminId });
    // 404 y no 403 para un cobrador de otro tenant: un 403 confirmaría que ese
    // id existe en la cartera de otro admin.
    if (!existing || existing.rol !== "COBRADOR") {
      throw new NotFoundException("Cobrador no encontrado.");
    }

    // Idempotente a propósito: si ya estaba inactivo, desasignar sus rutas
    // igual es correcto y devolver 204 evita un error inútil.
    await this.usuariosRepository.softDelete(id, adminId);
  }

  // Baja PERMANENTE: borra la fila de verdad. Solo posible si el cobrador
  // nunca registró un pago — `Pago.cobradorId` es `onDelete: Restrict`, así
  // que la base de datos rechazaría el DELETE igual si se lo saltara acá; el
  // chequeo previo solo cambia un error de FK opaco por un 409 legible. Con
  // historial, la única baja posible sigue siendo `remove` (desactivar).
  async removePermanent(id: string, user: AuthenticatedUser): Promise<void> {
    const adminId = requireAdminId(user);

    if (id === user.sub) {
      throw new ForbiddenException("No puedes eliminar tu propio usuario.");
    }

    const existing = await this.usuariosRepository.findById(id, { adminId });
    if (!existing || existing.rol !== "COBRADOR") {
      throw new NotFoundException("Cobrador no encontrado.");
    }

    const pagosCount = await this.usuariosRepository.countPagos(id);
    if (pagosCount > 0) {
      throw new ConflictException(
        `No puedes eliminar permanentemente a este cobrador: tiene ${pagosCount} pago(s) registrados en su historia. Solo puedes desactivarlo.`,
      );
    }

    await this.usuariosRepository.hardDelete(id, adminId);
  }

  // `/users` es la gestión de staff del admin autenticado.
  //   · rol=COBRADOR (default) → los cobradores de SU tenant.
  //   · rol=ADMIN → solo él mismo. Un admin no administra a otros admins; los
  //     demás son tenants ajenos y no deben ni listarse.
  // Un rol no-staff (`CLIENTE`) cae al default COBRADOR.
  private scopeWhere(rol: Rol | undefined, user: AuthenticatedUser): Prisma.UsuarioWhereInput {
    const adminId = requireAdminId(user);
    return rol === "ADMIN" ? { rol: "ADMIN", id: adminId } : { rol: "COBRADOR", adminId };
  }

  private mapError(error: unknown): Error {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002")
        return new ConflictException("Ya existe un usuario con ese documento.");
      if (error.code === "P2025") return new BadRequestException("La ruta indicada no existe.");
    }
    return error as Error;
  }

  private toListItem(usuario: CobradorWithRelations): CobradorListItem {
    return {
      id: usuario.id,
      nombre: usuario.nombre,
      documento: usuario.documento,
      rol: usuario.rol,
      telefono: usuario.telefono,
      activo: usuario.activo,
      rutas: usuario.rutas.map((ruta) => ({ id: ruta.id, nombre: ruta.nombre })),
      clientesCount: usuario.rutas.reduce((sum, ruta) => sum + ruta._count.clientAdmins, 0),
      cobradoHoy: 0,
      pagosCount: usuario._count.pagos,
    };
  }
}

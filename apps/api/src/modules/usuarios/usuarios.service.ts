import {
  BadRequestException,
  ConflictException,
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
    };
  }
}

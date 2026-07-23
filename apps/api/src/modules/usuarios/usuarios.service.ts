import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import * as bcrypt from "bcrypt";
import type { CobradorListItem, CreateCobradorRequest, UpdateCobradorRequest } from "@repo/types";

import { UsuariosRepository, type CobradorWithRelations } from "./usuarios.repository";

@Injectable()
export class UsuariosService {
  constructor(private readonly usuariosRepository: UsuariosRepository) {}

  async findAll(rol?: "ADMIN" | "COBRADOR"): Promise<CobradorListItem[]> {
    const usuarios = await this.usuariosRepository.findMany({ rol: rol ?? "COBRADOR" });
    return usuarios.map((usuario) => this.toListItem(usuario));
  }

  async create(body: CreateCobradorRequest): Promise<CobradorListItem> {
    try {
      const usuario = await this.usuariosRepository.create({
        nombre: body.nombre,
        documento: body.documento,
        passwordHash: await bcrypt.hash(body.password, 10),
        rol: "COBRADOR",
      });

      if (body.rutaId !== undefined) {
        await this.usuariosRepository.assignRoute(usuario.id, body.rutaId ?? null);
      }

      const result = await this.usuariosRepository.findById(usuario.id);
      if (!result) throw new NotFoundException("El cobrador no existe.");
      return this.toListItem(result);
    } catch (error) {
      throw this.mapError(error);
    }
  }

  async update(id: string, body: UpdateCobradorRequest): Promise<CobradorListItem> {
    const existing = await this.usuariosRepository.findById(id);
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
        await this.usuariosRepository.assignRoute(id, body.rutaId);
      }

      const result = await this.usuariosRepository.findById(id);
      if (!result) throw new NotFoundException("Cobrador no encontrado.");
      return this.toListItem(result);
    } catch (error) {
      throw this.mapError(error);
    }
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
      clientesCount: usuario.rutas.reduce((sum, ruta) => sum + ruta._count.clientes, 0),
      cobradoHoy: 0,
    };
  }
}

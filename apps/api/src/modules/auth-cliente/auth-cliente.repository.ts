import { Injectable } from "@nestjs/common";
import type { Prisma, PrismaClient } from "@prisma/client";

import { PrismaService } from "../../core/prisma/prisma.service";

// Acceso a `Cliente` limitado a lo que necesita el feature `auth-cliente`:
// login (por documento), update de contadores de seguridad, y lookup por id.
// Mantiene la convención del repo: cero reglas de negocio, cero auth.
// (Capa de datos pura — ver `clientes/clients.repository.ts` para la nota.)
type Tx = Omit<PrismaClient, "$connect" | "$disconnect">;

@Injectable()
export class AuthClienteRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByDocumento(documento: string) {
    return this.prisma.cliente.findUnique({ where: { documento } });
  }

  findById(id: string) {
    return this.prisma.cliente.findUnique({ where: { id } });
  }

  // Solo lee lo necesario para que `MustChangePasswordGuard` decida sin pagar
  // el costo de traer el cliente entero en cada request.
  findMustChangePasswordById(id: string) {
    return this.prisma.cliente.findUnique({
      where: { id },
      select: { mustChangePassword: true },
    });
  }

  // Update usado por `login` (contadores + lastLoginAt) y por
  // `changePassword` (hash + mustChangePassword + reset de contadores).
  update(id: string, data: Prisma.ClienteUpdateInput, tx?: Tx) {
    const runner = (tx ?? this.prisma) as PrismaClient;
    return runner.cliente.update({ where: { id }, data });
  }
}

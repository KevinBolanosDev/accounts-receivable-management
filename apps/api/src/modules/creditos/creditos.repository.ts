import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";

import { PrismaService } from "../../core/prisma/prisma.service";

const creditoListInclude = {
  producto: { select: { id: true, nombre: true } },
} satisfies Prisma.CreditoInclude;

// `cliente.admins` filtrado por `adminId` (el propio tenant del crédito, ya
// que `Credito.adminId` es explícito): es la relación cliente↔admin que trae
// la ruta a mostrar en el detalle. Un crédito siempre tiene `adminId` fijo,
// así que esta relación siempre existe (el service la exige al crear, ver
// `creditos.service.ts`).
function buildCreditoDetailInclude(adminId: string) {
  return {
    ...creditoListInclude,
    cliente: {
      select: {
        id: true,
        nombre: true,
        admins: {
          where: { adminId },
          take: 1,
          select: { ruta: { select: { id: true, nombre: true } } },
        },
      },
    },
    pagos: {
      orderBy: { fecha: "desc" },
      include: { cobrador: { select: { nombre: true } } },
    },
  } satisfies Prisma.CreditoInclude;
}

export type CreditoWithProducto = Prisma.CreditoGetPayload<{
  include: typeof creditoListInclude;
}>;
export type CreditoWithDetail = Prisma.CreditoGetPayload<{
  include: ReturnType<typeof buildCreditoDetailInclude>;
}>;

@Injectable()
export class CreditosRepository {
  constructor(private readonly prisma: PrismaService) {}

  // `creditoId` (PK) en cliente-picking; `where` armado por el service según
  // el rol del usuario.
  findMany(where: Prisma.CreditoWhereInput): Promise<CreditoWithProducto[]> {
    return this.prisma.credito.findMany({
      where,
      include: creditoListInclude,
      orderBy: { fechaInicio: "desc" },
    });
  }

  findById(
    id: string,
    where: Prisma.CreditoWhereInput | undefined,
    adminId: string,
  ): Promise<CreditoWithDetail | null> {
    return this.prisma.credito.findFirst({
      where: { ...where, id },
      include: buildCreditoDetailInclude(adminId),
    });
  }

  findByCodigo(codigo: string): Promise<CreditoWithProducto | null> {
    return this.prisma.credito.findUnique({
      where: { codigo },
      include: creditoListInclude,
    });
  }

  create(data: Prisma.CreditoCreateInput): Promise<CreditoWithProducto> {
    return this.prisma.credito.create({ data, include: creditoListInclude });
  }

  update(id: string, data: Prisma.CreditoUpdateInput): Promise<CreditoWithProducto> {
    return this.prisma.credito.update({ where: { id }, data, include: creditoListInclude });
  }

  // Genera el siguiente `CR-XXXX` desde la secuencia de Postgres. La migración
  // de Fase 3 creó `credito_codigo_seq` START 2000; `nextval` es atómico, así
  // que varios POSTs concurrentes obtienen códigos distintos sin carrera.
  // El `@unique` del modelo es el respaldo (si fallara la unicidad por una
  // inserción manual, caemos a P2002 → ConflictException).
  async nextCodigo(): Promise<string> {
    const rows = await this.prisma.$queryRaw<{ nextval: bigint }[]>`
      SELECT nextval('"credito_codigo_seq"') AS nextval
    `;
    const n = Number(rows[0]!.nextval);
    return `CR-${n}`;
  }
}

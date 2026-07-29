import type { PrismaClient } from "@prisma/client";

// Documento del ADMIN sembrado por `prisma/seed.ts`. Es el dueño (tenant) de
// todos los fixtures de e2e: las rutas, clientes y productos que crean los
// tests tienen que nacer en el MISMO tenant con el que después se loguean,
// o el scoping multi-tenant los deja fuera y los tests fallan con 404.
export const SEED_ADMIN_DOCUMENTO = "1000000001";

export async function seedAdminId(prisma: PrismaClient): Promise<string> {
  const admin = await prisma.usuario.findUniqueOrThrow({
    where: { documento: SEED_ADMIN_DOCUMENTO },
  });
  return admin.id;
}

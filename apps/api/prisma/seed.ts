// Script de seed (Fase 1): siembra un Admin y un Cobrador para poder loguearse.
// Se ejecuta fuera de Nest, así que arma su propio PrismaClient con el driver
// adapter (igual que PrismaService) en vez de recibirlo por inyección.
import "dotenv/config";
import bcrypt from "bcrypt";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

// Mismas credenciales que ya usaba mockAuthService en el frontend (1.2), para
// que el swap mock → real de la sub-fase 1.8 no cambie nada del lado del navegador.
const USERS = [
  { documento: "1000000001", nombre: "Admin Demo", password: "admin123", rol: "ADMIN" as const },
  {
    documento: "1000000002",
    nombre: "Cobrador Demo",
    password: "cobrador123",
    rol: "COBRADOR" as const,
  },
];

async function main() {
  for (const user of USERS) {
    const passwordHash = await bcrypt.hash(user.password, 10);

    await prisma.usuario.upsert({
      where: { documento: user.documento },
      update: { nombre: user.nombre, passwordHash, rol: user.rol },
      create: {
        documento: user.documento,
        nombre: user.nombre,
        passwordHash,
        rol: user.rol,
      },
    });

    console.log(`Usuario sembrado: ${user.nombre} (${user.rol}, documento ${user.documento})`);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });

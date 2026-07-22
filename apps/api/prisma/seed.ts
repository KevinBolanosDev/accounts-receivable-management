// Script de seed (Fase 1 + Fase 2): siembra usuarios, rutas y clientes demo.
// Se ejecuta fuera de Nest, así que arma su propio PrismaClient con el driver
// adapter (igual que PrismaService) en vez de recibirlo por inyección.
import "dotenv/config";
import { randomBytes } from "node:crypto";
import bcrypt from "bcrypt";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

function generarTokenAcceso(): string {
  return randomBytes(32).toString("base64url");
}

// Mismas credenciales que ya usaba mockAuthService en el frontend (1.2), para
// que el swap mock → real de la sub-fase 1.8 no cambie nada del lado del navegador.
// El segundo cobrador (Fase 2) existe para que el e2e de scoping tenga sentido:
// necesita a alguien con rutas/clientes propios y distintos a los del primero.
const USERS = [
  { documento: "1000000001", nombre: "Admin Demo", password: "admin123", rol: "ADMIN" as const },
  {
    documento: "1000000002",
    nombre: "Cobrador Demo",
    telefono: "3001234567",
    password: "cobrador123",
    rol: "COBRADOR" as const,
  },
  {
    documento: "1000000003",
    nombre: "Cobrador Demo 2",
    telefono: "3007654321",
    password: "cobrador123",
    rol: "COBRADOR" as const,
  },
];

// rutaId se resuelve en tiempo de ejecución (después de sembrar las rutas).
const CLIENTES = [
  {
    documento: "3001112222",
    nombre: "María Fernández",
    telefono: "3011112222",
    direccion: "Cra 12 #34-56, Centro",
    rutaNombre: "Ruta Centro",
  },
  {
    documento: "3002223333",
    nombre: "Carlos Ramírez",
    telefono: "3012223333",
    direccion: "Cll 45 #10-20, Centro",
    rutaNombre: "Ruta Centro",
  },
  {
    documento: "3003334444",
    nombre: "Luisa Gómez",
    telefono: "3013334444",
    direccion: "Av. Siempre Viva 742, Norte",
    rutaNombre: "Ruta Norte",
  },
  {
    documento: "3004445555",
    nombre: "Andrés Torres",
    telefono: "3014445555",
    direccion: "Cra 8 #90-15, Norte",
    rutaNombre: "Ruta Norte",
  },
  {
    documento: "3005556666",
    nombre: "Paola Rojas",
    telefono: "3015556666",
    direccion: "Cll 20 #5-30, Sur",
    rutaNombre: "Ruta Sur",
  },
  {
    documento: "3006667777",
    nombre: "Jorge Salazar",
    telefono: "3016667777",
    direccion: "Cra 30 #60-12, Oeste",
    rutaNombre: "Ruta Oeste",
  },
];

async function seedUsuarios(): Promise<void> {
  for (const user of USERS) {
    const passwordHash = await bcrypt.hash(user.password, 10);

    await prisma.usuario.upsert({
      where: { documento: user.documento },
      update: { nombre: user.nombre, passwordHash, rol: user.rol, telefono: user.telefono ?? null },
      create: {
        documento: user.documento,
        nombre: user.nombre,
        passwordHash,
        rol: user.rol,
        telefono: user.telefono ?? null,
      },
    });

    console.log(`Usuario sembrado: ${user.nombre} (${user.rol}, documento ${user.documento})`);
  }
}

async function seedRutas(): Promise<void> {
  const cobrador1 = await prisma.usuario.findUniqueOrThrow({ where: { documento: "1000000002" } });
  const cobrador2 = await prisma.usuario.findUniqueOrThrow({ where: { documento: "1000000003" } });

  // Centro y Norte quedan con el primer cobrador; Sur queda SIN cobrador (para
  // probar que solo el Admin la ve); Oeste es la ruta propia del segundo
  // cobrador (necesaria para el e2e de aislamiento de scoping).
  const RUTAS = [
    { nombre: "Ruta Centro", cobradorId: cobrador1.id },
    { nombre: "Ruta Norte", cobradorId: cobrador1.id },
    { nombre: "Ruta Sur", cobradorId: null },
    { nombre: "Ruta Oeste", cobradorId: cobrador2.id },
  ];

  for (const ruta of RUTAS) {
    await prisma.ruta.upsert({
      where: { nombre: ruta.nombre },
      update: { cobradorId: ruta.cobradorId },
      create: { nombre: ruta.nombre, cobradorId: ruta.cobradorId },
    });

    console.log(`Ruta sembrada: ${ruta.nombre}`);
  }
}

async function seedClientes(): Promise<void> {
  for (const cliente of CLIENTES) {
    const ruta = await prisma.ruta.findUniqueOrThrow({ where: { nombre: cliente.rutaNombre } });

    await prisma.cliente.upsert({
      where: { documento: cliente.documento },
      update: {
        nombre: cliente.nombre,
        telefono: cliente.telefono,
        direccion: cliente.direccion,
        rutaId: ruta.id,
      },
      create: {
        documento: cliente.documento,
        nombre: cliente.nombre,
        telefono: cliente.telefono,
        direccion: cliente.direccion,
        rutaId: ruta.id,
        tokenAcceso: generarTokenAcceso(),
        fotoDocumentoFrenteUrl: null,
        fotoDocumentoReversoUrl: null,
      },
    });

    console.log(`Cliente sembrado: ${cliente.nombre} (${cliente.rutaNombre})`);
  }
}

async function main(): Promise<void> {
  await seedUsuarios();
  await seedRutas();
  await seedClientes();
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });

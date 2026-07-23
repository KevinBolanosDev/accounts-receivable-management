// Script de seed (Fase 1 + Fase 2 + Fase 3): usuarios, rutas, clientes, y
// ahora productos + créditos + pagos demo. Idempotente — usa upsert por
// nombre/codigo para que corra dos veces sin duplicar (requisito del seed).
import "dotenv/config";
import { randomBytes } from "node:crypto";
import bcrypt from "bcrypt";
import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma } from "@prisma/client";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

function generarTokenAcceso(): string {
  return randomBytes(32).toString("base64url");
}

// Mismas credenciales que el mockAuthService del frontend (1.2), para que el
// swap mock → real no cambie nada del lado del navegador. El segundo cobrador
// (Fase 2) sirve para el e2e de scoping; los productos/créditos (Fase 3) le
// dan al primero clientes ACTIVOS para que "Mi ruta de hoy" tenga datos.
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

// rutaId se resuelve en runtime (después de sembrar rutas).
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

// Productos del catálogo (Fase 3). Coherentes con los usados por los créditos.
const PRODUCTOS = [
  { nombre: "Nevera", precioBase: "1800000.00" },
  { nombre: "Televisor", precioBase: "1200000.00" },
  { nombre: "Estufa", precioBase: "950000.00" },
  { nombre: "Lavadora", precioBase: "1450000.00" },
  { nombre: "Licuadora", precioBase: "380000.00" },
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

async function seedProductos(): Promise<void> {
  for (const producto of PRODUCTOS) {
    await prisma.producto.upsert({
      where: { nombre: producto.nombre },
      update: { precioBase: new Prisma.Decimal(producto.precioBase), activo: true },
      create: {
        nombre: producto.nombre,
        precioBase: new Prisma.Decimal(producto.precioBase),
        activo: true,
      },
    });

    console.log(`Producto sembrado: ${producto.nombre}`);
  }
}

interface CreditoSeed {
  codigo: string;
  clienteDocumento: string;
  productoNombre: string;
  montoTotal: string;
  cuotaDiaria: string;
  pagos: { monto: string; cobradorDocumento: string }[];
}

// Créditos demo. `saldoPendiente` se materializa al final como
// `montoTotal - Σ pagos` (no se deja al server derivarlo en lectura: es
// evento-driven). El cobrador demo (1000000002) tiene varios clientes de su
// ruta (María + Carlos) con créditos ACTIVOS → es el set que usará "Mi ruta
// de hoy". También sembramos un PAGADO para que aparezca en pestaña Historial
// del detalle de cliente.
const CREDITOS: CreditoSeed[] = [
  {
    codigo: "CR-2041",
    clienteDocumento: "3001112222",
    productoNombre: "Nevera",
    montoTotal: "1000000.00",
    cuotaDiaria: "20000.00",
    pagos: [
      { monto: "20000.00", cobradorDocumento: "1000000002" },
      { monto: "20000.00", cobradorDocumento: "1000000002" },
    ],
  },
  {
    codigo: "CR-2050",
    clienteDocumento: "3002223333",
    productoNombre: "Lavadora",
    montoTotal: "1200000.00",
    cuotaDiaria: "25000.00",
    pagos: [{ monto: "25000.00", cobradorDocumento: "1000000002" }],
  },
  {
    // Crédito PAGADO: 5 pagos de 200k = 1000000 → saldo 0 → estado PAGADO.
    codigo: "CR-2060",
    clienteDocumento: "3006667777",
    productoNombre: "Televisor",
    montoTotal: "1000000.00",
    cuotaDiaria: "200000.00",
    pagos: [
      { monto: "200000.00", cobradorDocumento: "1000000003" },
      { monto: "200000.00", cobradorDocumento: "1000000003" },
      { monto: "200000.00", cobradorDocumento: "1000000003" },
      { monto: "200000.00", cobradorDocumento: "1000000003" },
      { monto: "200000.00", cobradorDocumento: "1000000003" },
    ],
  },
  {
    // Crédito recién creado, aún sin pagos (→ ACTIVO, saldo = montoTotal).
    codigo: "CR-2070",
    clienteDocumento: "3004445555",
    productoNombre: "Estufa",
    montoTotal: "600000.00",
    cuotaDiaria: "15000.00",
    pagos: [],
  },
];

async function seedCreditos(): Promise<void> {
  for (const c of CREDITOS) {
    const cliente = await prisma.cliente.findUniqueOrThrow({
      where: { documento: c.clienteDocumento },
    });
    const producto = await prisma.producto.findUniqueOrThrow({
      where: { nombre: c.productoNombre },
    });
    const montoTotal = new Prisma.Decimal(c.montoTotal);
    const totalPagado = c.pagos.reduce(
      (acc, p) => acc.add(new Prisma.Decimal(p.monto)),
      new Prisma.Decimal(0),
    );
    const saldoPendiente = montoTotal.sub(totalPagado);
    const estado = saldoPendiente.lte(0) ? "PAGADO" : "ACTIVO";

    const credito = await prisma.credito.upsert({
      where: { codigo: c.codigo },
      update: {
        clienteId: cliente.id,
        productoId: producto.id,
        montoTotal,
        cuotaDiaria: new Prisma.Decimal(c.cuotaDiaria),
        saldoPendiente,
        estado,
      },
      create: {
        id: undefined, // deja que Prisma genere el UUID (los códigos son únicos por índice)
        codigo: c.codigo,
        clienteId: cliente.id,
        productoId: producto.id,
        montoTotal,
        cuotaDiaria: new Prisma.Decimal(c.cuotaDiaria),
        saldoPendiente,
        estado,
      },
    });

    // Pagos: idempotente (mismo monto+credito+cobrador → borrar y reinsertar los
    // del set). Como son demo y queremos que los IDs no cambien entre seeds,
    // barremos los existentes del crédito antes de sembrar.
    await prisma.pago.deleteMany({ where: { creditoId: credito.id } });
    for (const pago of c.pagos) {
      const cobrador = await prisma.usuario.findUniqueOrThrow({
        where: { documento: pago.cobradorDocumento },
      });
      await prisma.pago.create({
        data: {
          creditoId: credito.id,
          monto: new Prisma.Decimal(pago.monto),
          cobradorId: cobrador.id,
        },
      });
    }

    console.log(
      `Crédito sembrado: ${c.codigo} · ${cliente.nombre} · ${c.productoNombre} · ` +
        `saldo ${saldoPendiente.toFixed(2)} (${estado})`,
    );
  }
}

async function main(): Promise<void> {
  await seedUsuarios();
  await seedRutas();
  await seedClientes();
  await seedProductos();
  await seedCreditos();
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });

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
// (La generación de `tokenAcceso` quedó obsoleta en Fase 4 — el acceso del
// cliente ahora es por credenciales, no por token. Se conserva solo como
// helper interno por si se reactiva en el futuro.)
void generarTokenAcceso;

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
  // Fase 4 — María y Carlos son los dos clientes demo del portal (Ruta Centro).
  // Reciben `passwordHash` + `mustChangePassword=true` + `passwordExpiresAt=now+24h`
  // para probar el flujo end-to-end: el cliente entra con `cliente123` y el
  // sistema fuerza el cambio de contraseña en el primer ingreso.
  {
    documento: "1000000010",
    nombre: "María Fernández",
    telefono: "3011112222",
    direccion: "Cra 12 #34-56, Centro",
    rutaNombre: "Ruta Centro",
    passwordHash: bcrypt.hashSync("cliente123", 10),
    mustChangePassword: true,
    passwordExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  },
  {
    documento: "1000000011",
    nombre: "Carlos Ramírez",
    telefono: "3012223333",
    direccion: "Cll 45 #10-20, Centro",
    rutaNombre: "Ruta Centro",
    passwordHash: bcrypt.hashSync("cliente123", 10),
    mustChangePassword: true,
    passwordExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
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
        passwordHash: cliente.passwordHash ?? null,
        mustChangePassword: cliente.mustChangePassword ?? false,
        passwordExpiresAt: cliente.passwordExpiresAt ?? null,
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
      create: {
        documento: cliente.documento,
        nombre: cliente.nombre,
        telefono: cliente.telefono,
        direccion: cliente.direccion,
        rutaId: ruta.id,
        passwordHash: cliente.passwordHash ?? null,
        mustChangePassword: cliente.mustChangePassword ?? false,
        passwordExpiresAt: cliente.passwordExpiresAt ?? null,
        failedLoginAttempts: 0,
        lockedUntil: null,
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
  producto: string; // texto libre (nombre) — se registra por upsert
  monto: string; // capital (sin interés)
  interes: string; // % de interés
  dias: number; // plazo = número de cuotas diarias
  pagos: { monto: string; cobradorDocumento: string }[];
}

// Créditos demo. El seed guarda `monto`/`interes`/`dias` y DERIVA
// `montoTotal = monto + monto*interes/100`, `cuotaDiaria = montoTotal/dias` y
// `saldoPendiente = montoTotal - Σ pagos` (event-driven, igual que el service).
// El cobrador demo (1000000002) tiene varios clientes de su ruta (María +
// Carlos) con créditos ACTIVOS → es el set que usará "Mi ruta de hoy". También
// sembramos un PAGADO para que aparezca en la pestaña Historial del detalle.
const CREDITOS: CreditoSeed[] = [
  {
    // 1.000.000 + 20% = 1.200.000 ; /60 = 20.000/día ; pagó 40.000 → saldo 1.160.000
    codigo: "CR-2041",
    clienteDocumento: "3001112222",
    producto: "Nevera",
    monto: "1000000.00",
    interes: "20.00",
    dias: 60,
    pagos: [
      { monto: "20000.00", cobradorDocumento: "1000000002" },
      { monto: "20000.00", cobradorDocumento: "1000000002" },
    ],
  },
  {
    // 1.200.000 + 25% = 1.500.000 ; /60 = 25.000/día ; pagó 25.000 → saldo 1.475.000
    codigo: "CR-2050",
    clienteDocumento: "3002223333",
    producto: "Lavadora",
    monto: "1200000.00",
    interes: "25.00",
    dias: 60,
    pagos: [{ monto: "25000.00", cobradorDocumento: "1000000002" }],
  },
  {
    // PAGADO: 800.000 + 25% = 1.000.000 ; /5 = 200.000/día ; 5 pagos = saldo 0 → PAGADO.
    codigo: "CR-2060",
    clienteDocumento: "3006667777",
    producto: "Televisor",
    monto: "800000.00",
    interes: "25.00",
    dias: 5,
    pagos: [
      { monto: "200000.00", cobradorDocumento: "1000000003" },
      { monto: "200000.00", cobradorDocumento: "1000000003" },
      { monto: "200000.00", cobradorDocumento: "1000000003" },
      { monto: "200000.00", cobradorDocumento: "1000000003" },
      { monto: "200000.00", cobradorDocumento: "1000000003" },
    ],
  },
  {
    // Recién creado, sin pagos (→ ACTIVO, saldo = montoTotal). 500.000 + 20% = 600.000 ; /40 = 15.000/día.
    codigo: "CR-2070",
    clienteDocumento: "3004445555",
    producto: "Estufa",
    monto: "500000.00",
    interes: "20.00",
    dias: 40,
    pagos: [],
  },
];

async function seedCreditos(): Promise<void> {
  for (const c of CREDITOS) {
    const cliente = await prisma.cliente.findUniqueOrThrow({
      where: { documento: c.clienteDocumento },
    });
    // Producto por texto libre: upsert por nombre (igual que el service). No
    // pisa el precioBase de los sembrados en seedProductos.
    const monto = new Prisma.Decimal(c.monto);
    const producto = await prisma.producto.upsert({
      where: { nombre: c.producto },
      update: { activo: true },
      create: { nombre: c.producto, precioBase: monto, activo: true },
    });

    // Derivar montos como el service: total = monto + monto*interes/100.
    const interes = new Prisma.Decimal(c.interes);
    const montoTotal = monto.add(monto.mul(interes).div(100)).toDecimalPlaces(2);
    const cuotaDiaria = c.dias > 0 ? montoTotal.div(c.dias).toDecimalPlaces(2) : new Prisma.Decimal(0);
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
        monto,
        interes,
        dias: c.dias,
        montoTotal,
        cuotaDiaria,
        saldoPendiente,
        estado,
      },
      create: {
        id: undefined, // deja que Prisma genere el UUID (los códigos son únicos por índice)
        codigo: c.codigo,
        clienteId: cliente.id,
        productoId: producto.id,
        monto,
        interes,
        dias: c.dias,
        montoTotal,
        cuotaDiaria,
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
      `Crédito sembrado: ${c.codigo} · ${cliente.nombre} · ${c.producto} · ` +
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

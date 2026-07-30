import "dotenv/config";
import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { App } from "supertest/types";
import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";
import { loginResponseSchema } from "@repo/types";
import { AppModule } from "../src/app.module";
import { seedAdminId } from "./helpers/tenant";

// `DELETE /users/:id` es una BAJA LÓGICA: `activo: false` + sus rutas quedan
// sin cobrador. No borra la fila porque `Pago.cobradorId` es `onDelete:
// Restrict` — el histórico de cobros tiene que conservar su autor.
//
// Estos casos cubren las dos mitades que hacen que la baja signifique algo:
// que el endpoint respete el tenant, y que el cobrador dado de baja pierda de
// verdad el acceso (el filtro `activo` del login).
const SEED_ADMIN = { documento: "1000000001", password: "admin123" };
const PASSWORD = "cobrador123";
const PREFIX = "users-e2e-";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function login(
  app: INestApplication<App>,
  credentials: { documento: string; password: string },
) {
  const res = await request(app.getHttpServer()).post("/auth/login").send(credentials).expect(200);
  return loginResponseSchema.parse(res.body);
}

describe("Usuarios — baja de cobrador (e2e)", () => {
  let app: INestApplication<App>;
  let adminId: string;
  let stamp: number;

  // Cada test que borra necesita su propio cobrador: la baja no es reversible
  // desde la API y compartir fixture haría que el orden importara.
  async function createCollector(suffix: string) {
    const collector = await prisma.usuario.create({
      data: {
        nombre: `Cobrador ${suffix}`,
        documento: `${PREFIX}${suffix}-${stamp}`,
        passwordHash: await bcrypt.hash(PASSWORD, 10),
        rol: "COBRADOR",
        adminId,
      },
      select: { id: true, documento: true },
    });

    const route = await prisma.ruta.create({
      data: { nombre: `${PREFIX}ruta-${suffix}-${stamp}`, cobradorId: collector.id, adminId },
      select: { id: true },
    });

    return { ...collector, routeId: route.id };
  }

  beforeAll(async () => {
    stamp = Date.now();
    adminId = await seedAdminId(prisma);
  });

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(() => app.close());

  afterAll(async () => {
    await prisma.pago.deleteMany({ where: { credito: { codigo: { startsWith: "CR-USR-" } } } });
    await prisma.credito.deleteMany({ where: { codigo: { startsWith: "CR-USR-" } } });
    const clientes = await prisma.cliente.findMany({
      where: { documento: { startsWith: PREFIX } },
      select: { id: true },
    });
    await prisma.clientAdmin.deleteMany({ where: { clientId: { in: clientes.map((c) => c.id) } } });
    await prisma.cliente.deleteMany({ where: { documento: { startsWith: PREFIX } } });
    await prisma.producto.deleteMany({ where: { nombre: { startsWith: PREFIX } } });
    await prisma.ruta.deleteMany({ where: { nombre: { startsWith: PREFIX } } });
    await prisma.usuario.deleteMany({ where: { documento: { startsWith: PREFIX } } });
    await prisma.$disconnect();
  });

  it("responde 204 y deja al cobrador inactivo", async () => {
    const collector = await createCollector("baja");
    const { token } = await login(app, SEED_ADMIN);

    await request(app.getHttpServer())
      .delete(`/users/${collector.id}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(204);

    const after = await prisma.usuario.findUniqueOrThrow({ where: { id: collector.id } });
    expect(after.activo).toBe(false);
  });

  it("deja sus rutas sin cobrador asignado", async () => {
    const collector = await createCollector("rutas");
    const { token } = await login(app, SEED_ADMIN);

    await request(app.getHttpServer())
      .delete(`/users/${collector.id}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(204);

    const route = await prisma.ruta.findUniqueOrThrow({ where: { id: collector.routeId } });
    expect(route.cobradorId).toBeNull();
  });

  it("conserva los pagos que registró (auditoría)", async () => {
    const collector = await createCollector("pagos");

    const cliente = await prisma.cliente.create({
      data: {
        nombre: "Cliente Pagos E2E",
        telefono: "3000000000",
        documento: `${PREFIX}cliente-${stamp}`,
        direccion: "Test",
        admins: { create: { adminId, rutaId: collector.routeId } },
      },
    });
    const producto = await prisma.producto.create({
      data: {
        nombre: `${PREFIX}producto-${stamp}`,
        precioBase: new Prisma.Decimal(100000),
        adminId,
      },
    });
    const credito = await prisma.credito.create({
      data: {
        codigo: `CR-USR-${stamp}`,
        clienteId: cliente.id,
        productoId: producto.id,
        adminId,
        monto: new Prisma.Decimal(100000),
        interes: new Prisma.Decimal(0),
        cuotas: 10,
        dias: 10,
        montoTotal: new Prisma.Decimal(100000),
        cuotaDiaria: new Prisma.Decimal(10000),
        saldoPendiente: new Prisma.Decimal(90000),
        estado: "ACTIVO",
      },
    });
    const pago = await prisma.pago.create({
      data: {
        creditoId: credito.id,
        cobradorId: collector.id,
        monto: new Prisma.Decimal(10000),
      },
    });

    const { token } = await login(app, SEED_ADMIN);
    await request(app.getHttpServer())
      .delete(`/users/${collector.id}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(204);

    const after = await prisma.pago.findUniqueOrThrow({ where: { id: pago.id } });
    expect(after.cobradorId).toBe(collector.id);
  });

  it("el cobrador eliminado ya no puede iniciar sesión", async () => {
    const collector = await createCollector("login");

    // Antes de la baja sí entra: así el caso demuestra el cambio, no solo que
    // las credenciales de prueba estén mal.
    await login(app, { documento: collector.documento, password: PASSWORD });

    const { token } = await login(app, SEED_ADMIN);
    await request(app.getHttpServer())
      .delete(`/users/${collector.id}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(204);

    await request(app.getHttpServer())
      .post("/auth/login")
      .send({ documento: collector.documento, password: PASSWORD })
      .expect(401);
  });

  it("es idempotente: repetir el DELETE sigue devolviendo 204", async () => {
    const collector = await createCollector("idem");
    const { token } = await login(app, SEED_ADMIN);

    await request(app.getHttpServer())
      .delete(`/users/${collector.id}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(204);
    await request(app.getHttpServer())
      .delete(`/users/${collector.id}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(204);
  });

  it("responde 403 si el ADMIN intenta eliminarse a sí mismo", async () => {
    const { token, usuario } = await login(app, SEED_ADMIN);

    await request(app.getHttpServer())
      .delete(`/users/${usuario.id}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(403);

    const after = await prisma.usuario.findUniqueOrThrow({ where: { id: usuario.id } });
    expect(after.activo).toBe(true);
  });

  it("responde 404 (no 403) para un cobrador de otro tenant", async () => {
    const otherAdmin = await prisma.usuario.create({
      data: {
        nombre: "Otro Admin Users E2E",
        documento: `${PREFIX}otro-admin-${stamp}`,
        passwordHash: await bcrypt.hash(PASSWORD, 10),
        rol: "ADMIN",
      },
    });
    const foreign = await prisma.usuario.create({
      data: {
        nombre: "Cobrador Ajeno",
        documento: `${PREFIX}ajeno-${stamp}`,
        passwordHash: await bcrypt.hash(PASSWORD, 10),
        rol: "COBRADOR",
        adminId: otherAdmin.id,
      },
    });

    const { token } = await login(app, SEED_ADMIN);
    // 404 y no 403: un 403 confirmaría que ese id existe en otro tenant.
    await request(app.getHttpServer())
      .delete(`/users/${foreign.id}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(404);

    const after = await prisma.usuario.findUniqueOrThrow({ where: { id: foreign.id } });
    expect(after.activo).toBe(true);
  });

  it("responde 403 si quien llama es COBRADOR", async () => {
    const collector = await createCollector("rol");
    const victim = await createCollector("victima");

    const { token } = await login(app, { documento: collector.documento, password: PASSWORD });
    await request(app.getHttpServer())
      .delete(`/users/${victim.id}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(403);
  });

  it("responde 401 sin token", async () => {
    const collector = await createCollector("sin-token");
    await request(app.getHttpServer()).delete(`/users/${collector.id}`).expect(401);
  });
});

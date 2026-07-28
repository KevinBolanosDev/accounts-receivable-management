import "dotenv/config";
import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { App } from "supertest/types";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";
import {
  clientLoginResponseSchema,
  generateAccessResponseSchema,
  loginResponseSchema,
} from "@repo/types";
import { AppModule } from "../src/app.module";

const ADMIN = { documento: "1000000001", password: "admin123" };
const COLLECTOR_A = { documento: "1000000002", password: "cobrador123" };
const COLLECTOR_B = { documento: "1000000003", password: "cobrador123" };
const ROUTE_PREFIX = "Clientes Access E2E";

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

describe("ClientesController — access (e2e)", () => {
  let app: INestApplication<App>;
  let routeA: { id: string };

  beforeAll(async () => {
    const collectorA = await prisma.usuario.findUniqueOrThrow({
      where: { documento: COLLECTOR_A.documento },
    });
    routeA = await prisma.ruta.create({
      data: { nombre: `${ROUTE_PREFIX} ${Date.now()}`, cobradorId: collectorA.id },
    });
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
    const routes = await prisma.ruta.findMany({
      where: { nombre: { startsWith: ROUTE_PREFIX } },
      select: { id: true },
    });
    const routeIds = routes.map((r) => r.id);
    await prisma.cliente.deleteMany({ where: { rutaId: { in: routeIds } } });
    await prisma.ruta.deleteMany({ where: { id: { in: routeIds } } });
    await prisma.$disconnect();
  });

  async function createCliente(overrides: Record<string, unknown> = {}) {
    return prisma.cliente.create({
      data: {
        nombre: "Cliente Access E2E",
        telefono: "3000000000",
        documento: `clientes-access-e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        direccion: "Test",
        rutaId: routeA.id,
        ...overrides,
      },
    });
  }

  it("ADMIN genera acceso y recibe temporaryPassword", async () => {
    const cliente = await createCliente();
    const admin = await login(app, ADMIN);

    const res = await request(app.getHttpServer())
      .post(`/clients/${cliente.id}/access`)
      .set("Authorization", `Bearer ${admin.token}`)
      .expect(201);

    const body = generateAccessResponseSchema.parse(res.body);
    expect(body.temporaryPassword.length).toBeGreaterThan(0);

    const updated = await prisma.cliente.findUniqueOrThrow({ where: { id: cliente.id } });
    expect(updated.passwordHash).not.toBeNull();
    expect(updated.mustChangePassword).toBe(true);
  });

  it("un COBRADOR de otra ruta recibe 403", async () => {
    const cliente = await createCliente();
    const collectorB = await login(app, COLLECTOR_B);

    await request(app.getHttpServer())
      .post(`/clients/${cliente.id}/access`)
      .set("Authorization", `Bearer ${collectorB.token}`)
      .expect(403);
  });

  it("DELETE elimina el acceso de un cliente", async () => {
    const cliente = await createCliente({
      passwordHash: "hash-cualquiera",
      mustChangePassword: true,
    });
    const admin = await login(app, ADMIN);

    await request(app.getHttpServer())
      .delete(`/clients/${cliente.id}/access`)
      .set("Authorization", `Bearer ${admin.token}`)
      .expect(204);

    const updated = await prisma.cliente.findUniqueOrThrow({ where: { id: cliente.id } });
    expect(updated.passwordHash).toBeNull();
    expect(updated.mustChangePassword).toBe(false);
  });

  it("un CLIENTE no puede generar acceso para OTRO cliente (toma de cuenta)", async () => {
    const victima = await createCliente();
    const password = "clienteE2e123";
    const atacante = await createCliente({
      passwordHash: await bcrypt.hash(password, 10),
      mustChangePassword: true,
      passwordExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });

    const loginRes = await request(app.getHttpServer())
      .post("/client-auth/login")
      .send({ documento: atacante.documento, password })
      .expect(200);
    const clientToken = clientLoginResponseSchema.parse(loginRes.body).token;

    // Antes de este fix, `POST /clients/:id/access` no tenía `@Roles`: un
    // cliente autenticado del portal podía resetear la contraseña de
    // CUALQUIER otro cliente y recibir su `temporaryPassword` — toma de
    // cuenta ajena (hallazgo de auditoría, ver PLAN_DESARROLLO §1.1).
    await request(app.getHttpServer())
      .post(`/clients/${victima.id}/access`)
      .set("Authorization", `Bearer ${clientToken}`)
      .expect(403);

    const untouched = await prisma.cliente.findUniqueOrThrow({ where: { id: victima.id } });
    expect(untouched.passwordHash).toBeNull();
  });

  it("responde 400 al generar acceso sobre un cliente inactivo", async () => {
    const cliente = await createCliente({ activo: false });
    const admin = await login(app, ADMIN);

    await request(app.getHttpServer())
      .post(`/clients/${cliente.id}/access`)
      .set("Authorization", `Bearer ${admin.token}`)
      .expect(400);
  });
});

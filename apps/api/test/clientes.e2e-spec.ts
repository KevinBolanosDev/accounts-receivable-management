import "dotenv/config";
import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { App } from "supertest/types";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";
import {
  clienteDetailSchema,
  clienteListItemSchema,
  clientLoginResponseSchema,
  loginResponseSchema,
} from "@repo/types";
import { AppModule } from "../src/app.module";

const ADMIN = { documento: "1000000001", password: "admin123" };
const COLLECTOR_A = { documento: "1000000002", password: "cobrador123" };
const COLLECTOR_B = { documento: "1000000003", password: "cobrador123" };

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function login(
  app: INestApplication<App>,
  credentials: { documento: string; password: string },
) {
  const response = await request(app.getHttpServer())
    .post("/auth/login")
    .send(credentials)
    .expect(200);
  return loginResponseSchema.parse(response.body);
}

describe("ClientsController (e2e)", () => {
  let app: INestApplication<App>;
  let routeA: { id: string };
  let routeB: { id: string };

  beforeAll(async () => {
    await prisma.cliente.deleteMany({ where: { documento: { startsWith: "client-e2e-" } } });
    const collectorA = await prisma.usuario.findUniqueOrThrow({
      where: { documento: COLLECTOR_A.documento },
    });
    const collectorB = await prisma.usuario.findUniqueOrThrow({
      where: { documento: COLLECTOR_B.documento },
    });
    routeA = await prisma.ruta.create({
      data: { nombre: `Client E2E A ${Date.now()}`, cobradorId: collectorA.id },
    });
    routeB = await prisma.ruta.create({
      data: { nombre: `Client E2E B ${Date.now()}`, cobradorId: collectorB.id },
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
      where: { nombre: { startsWith: "Client E2E" } },
      select: { id: true },
    });
    await prisma.cliente.deleteMany({ where: { rutaId: { in: routes.map((route) => route.id) } } });
    await prisma.ruta.deleteMany({ where: { id: { in: routes.map((route) => route.id) } } });
    await prisma.$disconnect();
  });

  it("scopes the client list to the authenticated collector", async () => {
    const admin = await login(app, ADMIN);
    const created = await request(app.getHttpServer())
      .post("/clients")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({
        nombre: "Client A",
        telefono: "3000000000",
        documento: `client-e2e-${Date.now()}`,
        direccion: "Test",
        rutaId: routeA.id,
      })
      .expect(201);
    const clientId = clienteDetailSchema.parse(created.body).id;
    const collector = await login(app, COLLECTOR_B);
    const response = await request(app.getHttpServer())
      .get("/clients")
      .set("Authorization", `Bearer ${collector.token}`)
      .expect(200);
    const clients = clienteListItemSchema.array().parse(response.body);
    expect(clients.some((client) => client.id === clientId)).toBe(false);
  });

  it("rejects a collector creating a client outside their route", async () => {
    const collector = await login(app, COLLECTOR_A);
    await request(app.getHttpServer())
      .post("/clients")
      .set("Authorization", `Bearer ${collector.token}`)
      .send({
        nombre: "Forbidden Client",
        telefono: "3000000000",
        documento: `client-e2e-${Date.now()}`,
        direccion: "Test",
        rutaId: routeB.id,
      })
      .expect(403);
  });

  it("returns 404 for a collector accessing another route client", async () => {
    const admin = await login(app, ADMIN);
    const client = await prisma.cliente.create({
      data: {
        nombre: "Private Client",
        telefono: "3000000000",
        documento: `client-e2e-${Date.now()}`,
        direccion: "Test",
        rutaId: routeA.id,
      },
    });
    const collector = await login(app, COLLECTOR_B);
    await request(app.getHttpServer())
      .get(`/clients/${client.id}`)
      .set("Authorization", `Bearer ${collector.token}`)
      .expect(404);
    void admin;
  });

  it("soft-deletes a client only for an admin", async () => {
    const admin = await login(app, ADMIN);
    const client = await prisma.cliente.create({
      data: {
        nombre: "Delete Client",
        telefono: "3000000000",
        documento: `client-e2e-${Date.now()}`,
        direccion: "Test",
        rutaId: routeA.id,
      },
    });
    const collector = await login(app, COLLECTOR_A);
    await request(app.getHttpServer())
      .delete(`/clients/${client.id}`)
      .set("Authorization", `Bearer ${collector.token}`)
      .expect(403);
    await request(app.getHttpServer())
      .delete(`/clients/${client.id}`)
      .set("Authorization", `Bearer ${admin.token}`)
      .expect(204);
    const deleted = await prisma.cliente.findUniqueOrThrow({ where: { id: client.id } });
    expect(deleted.activo).toBe(false);
  });

  it("rejects a CLIENTE (portal) token on the staff clients endpoints", async () => {
    const password = "clienteE2e123";
    const cliente = await prisma.cliente.create({
      data: {
        nombre: "Client Role E2E",
        telefono: "3000000000",
        documento: `client-e2e-role-${Date.now()}`,
        direccion: "Test",
        rutaId: routeA.id,
        passwordHash: await bcrypt.hash(password, 10),
        mustChangePassword: true,
        passwordExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });
    const loginRes = await request(app.getHttpServer())
      .post("/client-auth/login")
      .send({ documento: cliente.documento, password })
      .expect(200);
    const clientToken = clientLoginResponseSchema.parse(loginRes.body).token;

    // Antes de este fix, `RolesGuard` dejaba pasar cualquier rol autenticado
    // porque el controller no declaraba `@Roles` — un cliente del portal
    // podía leer el listado completo de clientes (ver PLAN_DESARROLLO §1.1).
    await request(app.getHttpServer())
      .get("/clients")
      .set("Authorization", `Bearer ${clientToken}`)
      .expect(403);
  });

  it("returns a validated client detail", async () => {
    const admin = await login(app, ADMIN);
    const client = await prisma.cliente.create({
      data: {
        nombre: "Detail Client",
        telefono: "3000000000",
        documento: `client-e2e-${Date.now()}`,
        direccion: "Test",
        rutaId: routeA.id,
      },
    });
    const response = await request(app.getHttpServer())
      .get(`/clients/${client.id}`)
      .set("Authorization", `Bearer ${admin.token}`)
      .expect(200);
    expect(clienteDetailSchema.parse(response.body).id).toBe(client.id);
  });
});

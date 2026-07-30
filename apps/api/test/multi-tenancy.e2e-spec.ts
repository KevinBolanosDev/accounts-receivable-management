import "dotenv/config";
import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { App } from "supertest/types";
import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";
import {
  clienteListItemSchema,
  cobradorListItemSchema,
  creditoListItemSchema,
  loginResponseSchema,
  rutaListItemSchema,
} from "@repo/types";
import { AppModule } from "../src/app.module";
import { seedAdminId } from "./helpers/tenant";

// Regresión de la auditoría multi-tenant: antes de introducir `adminId`, el rol
// ADMIN significaba "ve todo" y dos administradores distintos compartían
// rutas, clientes, cobradores y créditos. Este archivo levanta un SEGUNDO
// tenant completo y verifica que el admin sembrado no lo alcance por ningún
// camino: ni listando, ni por id directo, ni escribiendo.
const SEED_ADMIN = { documento: "1000000001", password: "admin123" };
const OTHER_PASSWORD = "otroAdmin123";
const PREFIX = "tenant-e2e-";

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

describe("Multi-tenancy: aislamiento entre admins (e2e)", () => {
  let app: INestApplication<App>;
  let otherAdmin: { id: string; documento: string };
  let otherCollectorId: string;
  let otherRouteId: string;
  let otherClientId: string;
  let otherCreditId: string;
  let seedAdminRouteId: string;

  beforeAll(async () => {
    const stamp = Date.now();
    const passwordHash = await bcrypt.hash(OTHER_PASSWORD, 10);

    // Tenant B completo: admin + cobrador + ruta + cliente + producto + crédito.
    otherAdmin = await prisma.usuario.create({
      data: {
        nombre: "Otro Admin E2E",
        documento: `${PREFIX}admin-${stamp}`,
        passwordHash,
        rol: "ADMIN",
      },
      select: { id: true, documento: true },
    });

    const collector = await prisma.usuario.create({
      data: {
        nombre: "Otro Cobrador E2E",
        documento: `${PREFIX}collector-${stamp}`,
        passwordHash,
        rol: "COBRADOR",
        adminId: otherAdmin.id,
      },
    });
    otherCollectorId = collector.id;

    const route = await prisma.ruta.create({
      data: {
        nombre: `${PREFIX}ruta-${stamp}`,
        cobradorId: collector.id,
        adminId: otherAdmin.id,
      },
    });
    otherRouteId = route.id;

    const client = await prisma.cliente.create({
      data: {
        nombre: "Cliente Del Otro Tenant",
        telefono: "3000000000",
        documento: `${PREFIX}client-${stamp}`,
        direccion: "Test",
        admins: { create: { adminId: otherAdmin.id, rutaId: route.id } },
      },
    });
    otherClientId = client.id;

    const producto = await prisma.producto.create({
      data: {
        nombre: `${PREFIX}producto-${stamp}`,
        precioBase: new Prisma.Decimal(100000),
        adminId: otherAdmin.id,
      },
    });

    const credito = await prisma.credito.create({
      data: {
        codigo: `CR-TEN-${stamp}`,
        clienteId: client.id,
        productoId: producto.id,
        adminId: otherAdmin.id,
        monto: new Prisma.Decimal(100000),
        interes: new Prisma.Decimal(0),
        cuotas: 10,
        dias: 10,
        montoTotal: new Prisma.Decimal(100000),
        cuotaDiaria: new Prisma.Decimal(10000),
        saldoPendiente: new Prisma.Decimal(100000),
        estado: "ACTIVO",
      },
    });
    otherCreditId = credito.id;

    // Una ruta del tenant A, para el caso inverso (el otro admin tampoco debe
    // poder asignarle clientes ni verla).
    const seedRoute = await prisma.ruta.create({
      data: { nombre: `${PREFIX}seed-ruta-${stamp}`, adminId: await seedAdminId(prisma) },
    });
    seedAdminRouteId = seedRoute.id;
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
    await prisma.pago.deleteMany({ where: { credito: { codigo: { startsWith: "CR-TEN-" } } } });
    await prisma.credito.deleteMany({ where: { codigo: { startsWith: "CR-TEN-" } } });
    // ClientAdmin antes que Cliente/Ruta: Restrict hacia ambos.
    const clientes = await prisma.cliente.findMany({
      where: { documento: { startsWith: PREFIX } },
      select: { id: true },
    });
    await prisma.clientAdmin.deleteMany({
      where: { clientId: { in: clientes.map((c) => c.id) } },
    });
    await prisma.cliente.deleteMany({ where: { documento: { startsWith: PREFIX } } });
    await prisma.producto.deleteMany({ where: { nombre: { startsWith: PREFIX } } });
    await prisma.ruta.deleteMany({ where: { nombre: { startsWith: PREFIX } } });
    await prisma.usuario.deleteMany({ where: { documento: { startsWith: PREFIX } } });
    await prisma.$disconnect();
  });

  describe("lecturas", () => {
    it("GET /clients no incluye clientes de otro admin", async () => {
      const { token } = await login(app, SEED_ADMIN);
      const res = await request(app.getHttpServer())
        .get("/clients")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      const clients = clienteListItemSchema.array().parse(res.body);
      expect(clients.some((c) => c.id === otherClientId)).toBe(false);
    });

    it("GET /clients/:id responde 404 para un cliente de otro admin", async () => {
      const { token } = await login(app, SEED_ADMIN);
      await request(app.getHttpServer())
        .get(`/clients/${otherClientId}`)
        .set("Authorization", `Bearer ${token}`)
        .expect(404);
    });

    it("GET /routes no incluye rutas de otro admin", async () => {
      const { token } = await login(app, SEED_ADMIN);
      const res = await request(app.getHttpServer())
        .get("/routes")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      const routes = rutaListItemSchema.array().parse(res.body);
      expect(routes.some((r) => r.id === otherRouteId)).toBe(false);
    });

    it("GET /routes/:id responde 404 para una ruta de otro admin", async () => {
      const { token } = await login(app, SEED_ADMIN);
      await request(app.getHttpServer())
        .get(`/routes/${otherRouteId}`)
        .set("Authorization", `Bearer ${token}`)
        .expect(404);
    });

    it("GET /credits no incluye créditos de otro admin", async () => {
      const { token } = await login(app, SEED_ADMIN);
      const res = await request(app.getHttpServer())
        .get("/credits")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      const credits = creditoListItemSchema.array().parse(res.body);
      expect(credits.some((c) => c.id === otherCreditId)).toBe(false);
    });

    it("GET /credits/:id responde 404 para un crédito de otro admin", async () => {
      const { token } = await login(app, SEED_ADMIN);
      await request(app.getHttpServer())
        .get(`/credits/${otherCreditId}`)
        .set("Authorization", `Bearer ${token}`)
        .expect(404);
    });

    it("GET /users no incluye cobradores de otro admin", async () => {
      const { token } = await login(app, SEED_ADMIN);
      const res = await request(app.getHttpServer())
        .get("/users")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      const users = cobradorListItemSchema.array().parse(res.body);
      expect(users.some((u) => u.id === otherCollectorId)).toBe(false);
    });
  });

  describe("escrituras", () => {
    it("DELETE /clients/:id responde 404 para un cliente de otro admin", async () => {
      const { token } = await login(app, SEED_ADMIN);
      await request(app.getHttpServer())
        .delete(`/clients/${otherClientId}`)
        .set("Authorization", `Bearer ${token}`)
        .expect(404);

      // Y sigue activo: el 404 no debe haber sido un soft-delete silencioso.
      // `activo` es propiedad de la relación (ClientAdmin), no del Cliente.
      const stillActive = await prisma.clientAdmin.findUniqueOrThrow({
        where: { clientId_adminId: { clientId: otherClientId, adminId: otherAdmin.id } },
      });
      expect(stillActive.activo).toBe(true);
    });

    it("DELETE /credits/:id responde 404 para un crédito de otro admin", async () => {
      const { token } = await login(app, SEED_ADMIN);
      await request(app.getHttpServer())
        .delete(`/credits/${otherCreditId}`)
        .set("Authorization", `Bearer ${token}`)
        .expect(404);

      const unchanged = await prisma.credito.findUniqueOrThrow({ where: { id: otherCreditId } });
      expect(unchanged.estado).toBe("ACTIVO");
    });

    it("POST /clients rechaza asignar un cliente a una ruta de otro admin", async () => {
      const { token } = await login(app, SEED_ADMIN);
      await request(app.getHttpServer())
        .post("/clients")
        .set("Authorization", `Bearer ${token}`)
        .send({
          nombre: "Intruso",
          telefono: "3000000000",
          documento: `${PREFIX}intruso-${Date.now()}`,
          direccion: "Test",
          rutaId: otherRouteId,
        })
        .expect(404);
    });

    it("POST /collections responde 404 sobre un crédito de otro admin", async () => {
      const { token } = await login(app, SEED_ADMIN);
      await request(app.getHttpServer())
        .post("/collections")
        .set("Authorization", `Bearer ${token}`)
        .send({ creditoId: otherCreditId, monto: 10000 })
        .expect(404);

      // El saldo no se movió.
      const unchanged = await prisma.credito.findUniqueOrThrow({ where: { id: otherCreditId } });
      expect(Number(unchanged.saldoPendiente.toString())).toBe(100000);
    });

    it("el otro admin tampoco puede arrastrar clientes a una ruta del tenant sembrado", async () => {
      const { token } = await login(app, {
        documento: otherAdmin.documento,
        password: OTHER_PASSWORD,
      });
      await request(app.getHttpServer())
        .post(`/routes/${seedAdminRouteId}/clients`)
        .set("Authorization", `Bearer ${token}`)
        .send({ clienteIds: [otherClientId] })
        .expect(404);
    });

    it("un admin nuevo arranca con la cartera vacía", async () => {
      const { token } = await login(app, {
        documento: otherAdmin.documento,
        password: OTHER_PASSWORD,
      });
      const res = await request(app.getHttpServer())
        .get("/clients")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      // Solo ve el suyo, ninguno de los 14 del tenant sembrado.
      const clients = clienteListItemSchema.array().parse(res.body);
      expect(clients.map((c) => c.id)).toEqual([otherClientId]);
    });
  });
});

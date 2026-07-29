import "dotenv/config";
import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import { randomBytes } from "node:crypto";
import request from "supertest";
import { App } from "supertest/types";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";
import {
  clientLoginResponseSchema,
  loginResponseSchema,
  rutaDetailSchema,
  rutaListItemSchema,
  usuarioSchema,
} from "@repo/types";
import { AppModule } from "./../src/app.module";
import { seedAdminId } from "./helpers/tenant";

// Precondición: la base tiene el seed de la Fase 2 (`pnpm db:seed`) — Admin,
// dos Cobradores demo con rutas propias, y Ruta Sur sin cobrador asignado.
const ADMIN = { documento: "1000000001", password: "admin123" };
const COBRADOR_A = { documento: "1000000002", password: "cobrador123" };
const COBRADOR_B = { documento: "1000000003", password: "cobrador123" };

// Prisma directo (sin pasar por la API) para sembrar/limpiar fixtures que la
// API todavía no expone en esta sub-fase (crear un Cliente es de la 2.13).
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

// Limpia restos de una corrida anterior (incluida una que haya fallado a
// mitad). Borra primero los ClientAdmin y Clientes de esas rutas: la ruta
// ahora se asigna vía ClientAdmin (relación cliente↔admin, `onDelete:
// Restrict` hacia Cliente Y hacia Ruta), así que un deleteMany de rutas
// huérfanas con algún cliente colgado fallaría y dejaría el suite
// irrecuperable sin esto.
async function limpiarFixturesE2E(): Promise<void> {
  const rutasTest = await prisma.ruta.findMany({
    where: { nombre: { startsWith: "Ruta E2E" } },
    select: { id: true },
  });
  if (rutasTest.length > 0) {
    const routeIds = rutasTest.map((r) => r.id);
    const clientAdmins = await prisma.clientAdmin.findMany({
      where: { rutaId: { in: routeIds } },
      select: { clientId: true },
    });
    const clienteIds = clientAdmins.map((ca) => ca.clientId);
    await prisma.clientAdmin.deleteMany({ where: { clientId: { in: clienteIds } } });
    await prisma.cliente.deleteMany({ where: { id: { in: clienteIds } } });
  }
  await prisma.ruta.deleteMany({ where: { nombre: { startsWith: "Ruta E2E" } } });
}

describe("RutasController (e2e)", () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    await limpiarFixturesE2E();
  });

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  afterAll(async () => {
    await limpiarFixturesE2E();
    await prisma.$disconnect();
  });

  describe("GET /rutas", () => {
    it("como Admin devuelve todas las rutas", async () => {
      const { token } = await login(app, ADMIN);

      const res = await request(app.getHttpServer())
        .get("/routes")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      const rutas = rutaListItemSchema.array().parse(res.body);
      expect(rutas.length).toBeGreaterThanOrEqual(4);
      expect(rutas.some((r) => r.cobrador === null)).toBe(true);
    });

    it("como Cobrador devuelve solo sus propias rutas", async () => {
      const { token } = await login(app, COBRADOR_A);
      const meRes = await request(app.getHttpServer())
        .get("/auth/me")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);
      const me = usuarioSchema.parse(meRes.body);

      const res = await request(app.getHttpServer())
        .get("/routes")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      const rutas = rutaListItemSchema.array().parse(res.body);
      expect(rutas.length).toBeGreaterThan(0);
      for (const ruta of rutas) {
        expect(ruta.cobradorId).toBe(me.id);
      }
    });

    it("responde 401 sin token", () => {
      return request(app.getHttpServer()).get("/routes").expect(401);
    });

    it("responde 403 con un token de CLIENTE (portal)", async () => {
      const password = "clienteE2e123";
      const cliente = await prisma.cliente.create({
        data: {
          nombre: "Cliente Roles E2E",
          telefono: "3000000000",
          documento: `rutas-e2e-client-${Date.now()}`,
          direccion: "Test",
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

      // Antes de este fix, `RutasController` no tenía `@Roles` en los GET —
      // un cliente del portal podía listar todas las rutas (hallazgo de
      // auditoría, ver PLAN_DESARROLLO §1.1).
      await request(app.getHttpServer())
        .get("/routes")
        .set("Authorization", `Bearer ${clientToken}`)
        .expect(403);

      await prisma.cliente.delete({ where: { id: cliente.id } });
    });
  });

  describe("GET /rutas/:id", () => {
    it("un Cobrador no puede ver el detalle de una ruta ajena (404)", async () => {
      const { token: tokenB } = await login(app, COBRADOR_B);
      const { token: tokenA } = await login(app, COBRADOR_A);

      const misRutas = await request(app.getHttpServer())
        .get("/routes")
        .set("Authorization", `Bearer ${tokenA}`)
        .expect(200);
      const [rutaDeA] = rutaListItemSchema.array().parse(misRutas.body);

      return request(app.getHttpServer())
        .get(`/routes/${rutaDeA!.id}`)
        .set("Authorization", `Bearer ${tokenB}`)
        .expect(404);
    });

    it("el Admin ve el detalle de cualquier ruta, con sus clientes", async () => {
      const { token } = await login(app, ADMIN);

      const listRes = await request(app.getHttpServer())
        .get("/routes")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);
      const rutas = rutaListItemSchema.array().parse(listRes.body);
      const ruta = rutas.find((r) => r.clientesCount > 0);
      expect(ruta).toBeDefined();

      const res = await request(app.getHttpServer())
        .get(`/routes/${ruta!.id}`)
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      const detail = rutaDetailSchema.parse(res.body);
      expect(detail.id).toBe(ruta!.id);
      expect(detail.clientes.length).toBe(detail.clientesCount);
      for (const cliente of detail.clientes) {
        expect(cliente.rutaId).toBe(ruta!.id);
      }
    });
  });

  describe("POST /rutas", () => {
    it("como Cobrador responde 403", async () => {
      const { token } = await login(app, COBRADOR_A);

      return request(app.getHttpServer())
        .post("/routes")
        .set("Authorization", `Bearer ${token}`)
        .send({ nombre: "Ruta E2E Prohibida" })
        .expect(403);
    });

    it("como Admin crea la ruta", async () => {
      const { token } = await login(app, ADMIN);

      const res = await request(app.getHttpServer())
        .post("/routes")
        .set("Authorization", `Bearer ${token}`)
        .send({ nombre: "Ruta E2E Creada" })
        .expect(201);

      const ruta = rutaListItemSchema.parse(res.body);
      expect(ruta.nombre).toBe("Ruta E2E Creada");
      expect(ruta.clientesCount).toBe(0);

      await prisma.ruta.delete({ where: { id: ruta.id } });
    });

    it("responde 400 si falta el nombre", async () => {
      const { token } = await login(app, ADMIN);

      return request(app.getHttpServer())
        .post("/routes")
        .set("Authorization", `Bearer ${token}`)
        .send({})
        .expect(400);
    });
  });

  describe("DELETE /rutas/:id", () => {
    it("responde 409 si la ruta tiene clientes asignados", async () => {
      const { token } = await login(app, ADMIN);

      const adminId = await seedAdminId(prisma);
      const ruta = await prisma.ruta.create({
        data: { nombre: "Ruta E2E Con Clientes", adminId },
      });
      const cliente = await prisma.cliente.create({
        data: {
          nombre: "Cliente E2E",
          telefono: "3000000000",
          documento: `e2e-${randomBytes(4).toString("hex")}`,
          direccion: "Dirección de prueba",
          admins: { create: { adminId, rutaId: ruta.id } },
        },
      });

      try {
        await request(app.getHttpServer())
          .delete(`/routes/${ruta.id}`)
          .set("Authorization", `Bearer ${token}`)
          .expect(409);
      } finally {
        // finally: si el expect(409) falla, igual hay que limpiar o el
        // deleteMany de nombre de la siguiente corrida choca con la FK
        // Restrict (cliente colgado) y deja el suite roto para todos los tests.
        // ClientAdmin primero: Restrict hacia Cliente Y hacia Ruta.
        await prisma.clientAdmin.deleteMany({ where: { clientId: cliente.id } });
        await prisma.cliente.delete({ where: { id: cliente.id } });
        await prisma.ruta.delete({ where: { id: ruta.id } });
      }
    });

    it("elimina una ruta sin clientes", async () => {
      const { token } = await login(app, ADMIN);
      const ruta = await prisma.ruta.create({
        data: { nombre: "Ruta E2E Vacía", adminId: await seedAdminId(prisma) },
      });

      await request(app.getHttpServer())
        .delete(`/routes/${ruta.id}`)
        .set("Authorization", `Bearer ${token}`)
        .expect(204);

      const encontrada = await prisma.ruta.findUnique({ where: { id: ruta.id } });
      expect(encontrada).toBeNull();
    });

    it("como Cobrador responde 403", async () => {
      const { token } = await login(app, COBRADOR_A);

      return request(app.getHttpServer())
        .delete("/routes/no-importa")
        .set("Authorization", `Bearer ${token}`)
        .expect(403);
    });
  });
});

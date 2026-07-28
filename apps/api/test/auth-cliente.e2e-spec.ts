import "dotenv/config";
import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { App } from "supertest/types";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";
import { clientAuthUserSchema, clientLoginResponseSchema, loginResponseSchema } from "@repo/types";
import { AppModule } from "../src/app.module";

const ADMIN = { documento: "1000000001", password: "admin123" };
const PLAIN_PASSWORD = "clienteE2e123";
const DOCUMENTO_PREFIX = "auth-cliente-e2e-";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

let counter = 0;
function uniqueDocumento(): string {
  counter += 1;
  return `${DOCUMENTO_PREFIX}${Date.now()}-${counter}`;
}

async function createTestCliente(overrides: Record<string, unknown> = {}) {
  return prisma.cliente.create({
    data: {
      nombre: "Cliente E2E",
      telefono: "3000000000",
      documento: uniqueDocumento(),
      direccion: "Test",
      passwordHash: await bcrypt.hash(PLAIN_PASSWORD, 10),
      mustChangePassword: true,
      passwordExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      ...overrides,
    },
  });
}

describe("AuthClienteController (e2e)", () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(() => app.close());

  afterAll(async () => {
    await prisma.cliente.deleteMany({ where: { documento: { startsWith: DOCUMENTO_PREFIX } } });
    await prisma.$disconnect();
  });

  describe("POST /client-auth/login", () => {
    it("devuelve token + cliente con credenciales válidas", async () => {
      const cliente = await createTestCliente();
      const res = await request(app.getHttpServer())
        .post("/client-auth/login")
        .send({ documento: cliente.documento, password: PLAIN_PASSWORD })
        .expect(200);

      const body = clientLoginResponseSchema.parse(res.body);
      expect(body.cliente.documento).toBe(cliente.documento);
      expect(body.cliente.mustChangePassword).toBe(true);
    });

    it("responde 401 genérico con documento inexistente", () => {
      return request(app.getHttpServer())
        .post("/client-auth/login")
        .send({ documento: "0000000000", password: "loquesea" })
        .expect(401);
    });

    it("responde 401 y suma failedLoginAttempts con password incorrecta", async () => {
      const cliente = await createTestCliente();
      await request(app.getHttpServer())
        .post("/client-auth/login")
        .send({ documento: cliente.documento, password: "password-incorrecta" })
        .expect(401);

      const updated = await prisma.cliente.findUniqueOrThrow({ where: { id: cliente.id } });
      expect(updated.failedLoginAttempts).toBe(1);
    });

    it("no pierde intentos bajo requests concurrentes (hallazgo de hardening, 4.17)", async () => {
      const cliente = await createTestCliente();
      // Por debajo de MAX_FAILED_ATTEMPTS (5) para medir el conteo limpio sin
      // que el lockout interrumpa el conteo, y por debajo del límite del
      // throttler (5/min) para no confundir un 429 de rate-limit con el bug
      // que este test previene.
      const CONCURRENT_ATTEMPTS = 4;

      await Promise.all(
        Array.from({ length: CONCURRENT_ATTEMPTS }, () =>
          request(app.getHttpServer())
            .post("/client-auth/login")
            .send({ documento: cliente.documento, password: "password-incorrecta" })
            .expect(401),
        ),
      );

      const updated = await prisma.cliente.findUniqueOrThrow({ where: { id: cliente.id } });
      expect(updated.failedLoginAttempts).toBe(CONCURRENT_ATTEMPTS);
    });

    it("responde 429 con ACCOUNT_LOCKED si lockedUntil está activo", async () => {
      const cliente = await createTestCliente({
        failedLoginAttempts: 5,
        lockedUntil: new Date(Date.now() + 10 * 60 * 1000),
      });

      const res = await request(app.getHttpServer())
        .post("/client-auth/login")
        .send({ documento: cliente.documento, password: PLAIN_PASSWORD })
        .expect(429);

      const body = res.body as { code?: string };
      expect(body.code).toBe("ACCOUNT_LOCKED");
    });

    it("responde 401 con mensaje específico si la temporal expiró, sin sumar intentos", async () => {
      const cliente = await createTestCliente({
        passwordExpiresAt: new Date(Date.now() - 60 * 1000),
      });

      const res = await request(app.getHttpServer())
        .post("/client-auth/login")
        .send({ documento: cliente.documento, password: PLAIN_PASSWORD })
        .expect(401);

      const body = res.body as { message?: string };
      expect(body.message).toMatch(/expiró/i);
      const updated = await prisma.cliente.findUniqueOrThrow({ where: { id: cliente.id } });
      expect(updated.failedLoginAttempts).toBe(0);
    });
  });

  describe("GET /client-auth/me", () => {
    it("responde 401 sin token", () => {
      return request(app.getHttpServer()).get("/client-auth/me").expect(401);
    });

    it("responde 403 con un token de staff", async () => {
      const login = await request(app.getHttpServer()).post("/auth/login").send(ADMIN).expect(200);
      const { token } = loginResponseSchema.parse(login.body);

      return request(app.getHttpServer())
        .get("/client-auth/me")
        .set("Authorization", `Bearer ${token}`)
        .expect(403);
    });

    it("responde 428 con MUST_CHANGE_PASSWORD si mustChangePassword=true", async () => {
      const cliente = await createTestCliente();
      const login = await request(app.getHttpServer())
        .post("/client-auth/login")
        .send({ documento: cliente.documento, password: PLAIN_PASSWORD })
        .expect(200);
      const { token } = clientLoginResponseSchema.parse(login.body);

      const res = await request(app.getHttpServer())
        .get("/client-auth/me")
        .set("Authorization", `Bearer ${token}`)
        .expect(428);

      const body = res.body as { code?: string };
      expect(body.code).toBe("MUST_CHANGE_PASSWORD");
    });
  });

  describe("POST /client-auth/change-password", () => {
    it("responde 401 si currentPassword es incorrecta", async () => {
      const cliente = await createTestCliente();
      const login = await request(app.getHttpServer())
        .post("/client-auth/login")
        .send({ documento: cliente.documento, password: PLAIN_PASSWORD })
        .expect(200);
      const { token } = clientLoginResponseSchema.parse(login.body);

      await request(app.getHttpServer())
        .post("/client-auth/change-password")
        .set("Authorization", `Bearer ${token}`)
        .send({ currentPassword: "otra-cosa", newPassword: "nuevaClave123" })
        .expect(401);
    });

    it("responde 400 si newPassword es igual a currentPassword", async () => {
      const cliente = await createTestCliente();
      const login = await request(app.getHttpServer())
        .post("/client-auth/login")
        .send({ documento: cliente.documento, password: PLAIN_PASSWORD })
        .expect(200);
      const { token } = clientLoginResponseSchema.parse(login.body);

      await request(app.getHttpServer())
        .post("/client-auth/change-password")
        .set("Authorization", `Bearer ${token}`)
        .send({ currentPassword: PLAIN_PASSWORD, newPassword: PLAIN_PASSWORD })
        .expect(400);
    });

    it("cambia la contraseña y limpia mustChangePassword + passwordExpiresAt", async () => {
      const cliente = await createTestCliente();
      const login = await request(app.getHttpServer())
        .post("/client-auth/login")
        .send({ documento: cliente.documento, password: PLAIN_PASSWORD })
        .expect(200);
      const { token } = clientLoginResponseSchema.parse(login.body);

      const res = await request(app.getHttpServer())
        .post("/client-auth/change-password")
        .set("Authorization", `Bearer ${token}`)
        .send({ currentPassword: PLAIN_PASSWORD, newPassword: "nuevaClave123" })
        .expect(200);

      const body = clientAuthUserSchema.parse(res.body);
      expect(body.mustChangePassword).toBe(false);

      const updated = await prisma.cliente.findUniqueOrThrow({ where: { id: cliente.id } });
      expect(updated.passwordExpiresAt).toBeNull();
      expect(updated.mustChangePassword).toBe(false);
    });
  });
});

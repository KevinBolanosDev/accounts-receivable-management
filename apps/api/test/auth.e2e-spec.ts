import "dotenv/config";
import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { App } from "supertest/types";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";
import { loginResponseSchema, usuarioSchema } from "@repo/types";
import { AppModule } from "./../src/app.module";
import { seedAdminId } from "./helpers/tenant";

// Precondición: la base de datos tiene los usuarios de prueba de la sub-fase
// 1.5 (correr `pnpm db:seed` antes). Son los mismos que usaba el mock del
// frontend en 1.2, para que 1.8 no tenga que cambiar ninguna credencial.
const ADMIN = { documento: "1000000001", password: "admin123" };
const COBRADOR = { documento: "1000000002", password: "cobrador123" };

// Fixtures de lockout: NUNCA reusar ADMIN/COBRADOR de arriba acá — el e2e
// completo corre `--runInBand` en un solo proceso, y bloquear la cuenta
// sembrada (`LOCKOUT_DURATION_MINUTES = 15`) rompería con 429 todos los
// demás archivos e2e que loguean como ADMIN después de este.
const PLAIN_PASSWORD = "lockoutE2e123";
const DOCUMENTO_PREFIX = "auth-lockout-e2e-";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

let counter = 0;
function uniqueDocumento(): string {
  counter += 1;
  return `${DOCUMENTO_PREFIX}${Date.now()}-${counter}`;
}

describe("AuthController (e2e)", () => {
  let app: INestApplication<App>;
  let adminId: string;

  async function createTestUsuario(overrides: Record<string, unknown> = {}) {
    return prisma.usuario.create({
      data: {
        nombre: "Cobrador Lockout E2E",
        documento: uniqueDocumento(),
        passwordHash: await bcrypt.hash(PLAIN_PASSWORD, 10),
        rol: "COBRADOR",
        adminId,
        ...overrides,
      },
    });
  }

  beforeAll(async () => {
    adminId = await seedAdminId(prisma);
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
    await prisma.usuario.deleteMany({ where: { documento: { startsWith: DOCUMENTO_PREFIX } } });
    await prisma.$disconnect();
  });

  describe("POST /auth/login", () => {
    it("devuelve token + usuario con credenciales válidas", async () => {
      const res = await request(app.getHttpServer()).post("/auth/login").send(ADMIN).expect(200);

      const body = loginResponseSchema.parse(res.body);
      expect(body.usuario.rol).toBe("ADMIN");
      expect(body.usuario.documento).toBe(ADMIN.documento);
    });

    it("responde 401 con contraseña incorrecta", () => {
      return request(app.getHttpServer())
        .post("/auth/login")
        .send({ documento: ADMIN.documento, password: "incorrecta" })
        .expect(401);
    });

    it("responde 400 si falta un campo requerido", () => {
      return request(app.getHttpServer())
        .post("/auth/login")
        .send({ documento: ADMIN.documento })
        .expect(400);
    });
  });

  // Fase 6 (hardening) — SEC-1: el login de staff no tenía lockout por
  // cuenta, solo throttle por IP. Mismo mecanismo que `AuthClienteService`
  // (ver `core/security/lockout-policy.ts`), mismos casos que
  // `auth-cliente.e2e-spec.ts`.
  describe("POST /auth/login — lockout de cuenta", () => {
    it("responde 401 y suma failedLoginAttempts con password incorrecta", async () => {
      const usuario = await createTestUsuario();
      await request(app.getHttpServer())
        .post("/auth/login")
        .send({ documento: usuario.documento, password: "password-incorrecta" })
        .expect(401);

      const updated = await prisma.usuario.findUniqueOrThrow({ where: { id: usuario.id } });
      expect(updated.failedLoginAttempts).toBe(1);
    });

    it("no pierde intentos bajo requests concurrentes", async () => {
      const usuario = await createTestUsuario();
      // Por debajo de MAX_FAILED_ATTEMPTS (5) para medir el conteo limpio sin
      // que el lockout interrumpa el conteo, y por debajo del límite del
      // throttler de login (10/min) para no confundir un 429 de rate-limit
      // con el bug que este test previene.
      const CONCURRENT_ATTEMPTS = 4;

      await Promise.all(
        Array.from({ length: CONCURRENT_ATTEMPTS }, () =>
          request(app.getHttpServer())
            .post("/auth/login")
            .send({ documento: usuario.documento, password: "password-incorrecta" })
            .expect(401),
        ),
      );

      const updated = await prisma.usuario.findUniqueOrThrow({ where: { id: usuario.id } });
      expect(updated.failedLoginAttempts).toBe(CONCURRENT_ATTEMPTS);
    });

    it("responde 429 con ACCOUNT_LOCKED si lockedUntil está activo", async () => {
      const usuario = await createTestUsuario({
        failedLoginAttempts: 5,
        lockedUntil: new Date(Date.now() + 10 * 60 * 1000),
      });

      const res = await request(app.getHttpServer())
        .post("/auth/login")
        .send({ documento: usuario.documento, password: PLAIN_PASSWORD })
        .expect(429);

      const body = res.body as { code?: string };
      expect(body.code).toBe("ACCOUNT_LOCKED");
    });

    it("un login exitoso limpia failedLoginAttempts y lockedUntil", async () => {
      const usuario = await createTestUsuario({ failedLoginAttempts: 3 });

      await request(app.getHttpServer())
        .post("/auth/login")
        .send({ documento: usuario.documento, password: PLAIN_PASSWORD })
        .expect(200);

      const updated = await prisma.usuario.findUniqueOrThrow({ where: { id: usuario.id } });
      expect(updated.failedLoginAttempts).toBe(0);
      expect(updated.lockedUntil).toBeNull();
    });

    it("un cobrador inactivo no suma intentos (mismo 401 genérico)", async () => {
      const usuario = await createTestUsuario({ activo: false });

      await request(app.getHttpServer())
        .post("/auth/login")
        .send({ documento: usuario.documento, password: PLAIN_PASSWORD })
        .expect(401);

      const updated = await prisma.usuario.findUniqueOrThrow({ where: { id: usuario.id } });
      expect(updated.failedLoginAttempts).toBe(0);
    });
  });

  describe("GET /auth/me", () => {
    it("responde 401 sin token", () => {
      return request(app.getHttpServer()).get("/auth/me").expect(401);
    });

    it("devuelve el usuario con un token válido", async () => {
      const login = await request(app.getHttpServer()).post("/auth/login").send(ADMIN);
      const { token } = loginResponseSchema.parse(login.body);

      const res = await request(app.getHttpServer())
        .get("/auth/me")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      const usuario = usuarioSchema.parse(res.body);
      expect(usuario.rol).toBe("ADMIN");
    });
  });

  describe("GET /auth/admin-only", () => {
    it("responde 403 para un Cobrador autenticado", async () => {
      const login = await request(app.getHttpServer()).post("/auth/login").send(COBRADOR);
      const { token } = loginResponseSchema.parse(login.body);

      return request(app.getHttpServer())
        .get("/auth/admin-only")
        .set("Authorization", `Bearer ${token}`)
        .expect(403);
    });

    it("responde 200 para un Admin autenticado", async () => {
      const login = await request(app.getHttpServer()).post("/auth/login").send(ADMIN);
      const { token } = loginResponseSchema.parse(login.body);

      return request(app.getHttpServer())
        .get("/auth/admin-only")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);
    });
  });
});

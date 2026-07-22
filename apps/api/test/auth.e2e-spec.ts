import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { App } from "supertest/types";
import { loginResponseSchema, usuarioSchema } from "@repo/types";
import { AppModule } from "./../src/app.module";

// Precondición: la base de datos tiene los usuarios de prueba de la sub-fase
// 1.5 (correr `pnpm db:seed` antes). Son los mismos que usaba el mock del
// frontend en 1.2, para que 1.8 no tenga que cambiar ninguna credencial.
const ADMIN = { documento: "1000000001", password: "admin123" };
const COBRADOR = { documento: "1000000002", password: "cobrador123" };

describe("AuthController (e2e)", () => {
  let app: INestApplication<App>;

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

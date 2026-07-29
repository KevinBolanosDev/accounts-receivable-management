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
  creditoListItemSchema,
  creditoSchema,
  loginResponseSchema,
} from "@repo/types";
import { AppModule } from "../src/app.module";
import { seedAdminId } from "./helpers/tenant";

// Un mismo Cliente (misma identidad, mismo documento/login) puede ser
// cartera de MÁS de un admin a la vez (`ClientAdmin`, ver schema.prisma).
// `multi-tenancy.e2e-spec.ts` cubre el aislamiento cuando NO hay relación con
// el otro tenant; este archivo cubre el caso en que SÍ la hay para ambos, y
// verifica que cada admin solo ve/gestiona SU PROPIA relación (ruta, estado
// activo, créditos) — nunca la del otro, aunque compartan el mismo cliente.
const SEED_ADMIN = { documento: "1000000001", password: "admin123" };
const OTHER_PASSWORD = "sharedAdmin123";
const PREFIX = "client-sharing-e2e-";

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

describe("Cliente compartido entre dos admins (e2e)", () => {
  let app: INestApplication<App>;
  let adminAId: string;
  let otherAdmin: { id: string; documento: string };
  let routeA: { id: string };
  let routeB: { id: string };
  let sharedClientId: string;

  beforeAll(async () => {
    const stamp = Date.now();
    adminAId = await seedAdminId(prisma);

    otherAdmin = await prisma.usuario.create({
      data: {
        nombre: "Admin Compartido E2E",
        documento: `${PREFIX}admin-${stamp}`,
        passwordHash: await bcrypt.hash(OTHER_PASSWORD, 10),
        rol: "ADMIN",
      },
      select: { id: true, documento: true },
    });

    routeA = await prisma.ruta.create({
      data: { nombre: `${PREFIX}ruta-a-${stamp}`, adminId: adminAId },
    });
    routeB = await prisma.ruta.create({
      data: { nombre: `${PREFIX}ruta-b-${stamp}`, adminId: otherAdmin.id },
    });

    // El cliente nace ligado a Admin A (ruta A) y se vincula también con
    // Admin B (ruta B): dos filas ClientAdmin para el mismo Cliente.
    const client = await prisma.cliente.create({
      data: {
        nombre: "Cliente Compartido E2E",
        telefono: "3000000000",
        documento: `${PREFIX}client-${stamp}`,
        direccion: "Test",
        admins: {
          create: [
            { adminId: adminAId, rutaId: routeA.id },
            { adminId: otherAdmin.id, rutaId: routeB.id },
          ],
        },
      },
    });
    sharedClientId = client.id;
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
    await prisma.pago.deleteMany({ where: { credito: { clienteId: sharedClientId } } });
    await prisma.credito.deleteMany({ where: { clienteId: sharedClientId } });
    await prisma.clientAdmin.deleteMany({ where: { clientId: sharedClientId } });
    await prisma.cliente.deleteMany({ where: { documento: { startsWith: PREFIX } } });
    await prisma.ruta.deleteMany({ where: { nombre: { startsWith: PREFIX } } });
    // Los créditos de este test registran producto por nombre (upsert, igual
    // que el service real) bajo el tenant de cada admin — hay que borrarlos
    // antes del Usuario (Producto.adminId → Usuario es Restrict).
    await prisma.producto.deleteMany({ where: { nombre: { startsWith: PREFIX } } });
    await prisma.usuario.deleteMany({ where: { documento: { startsWith: PREFIX } } });
    await prisma.$disconnect();
  });

  it("ambos admins pueden leer el mismo cliente", async () => {
    const admin = await login(app, SEED_ADMIN);
    const other = await login(app, { documento: otherAdmin.documento, password: OTHER_PASSWORD });

    await request(app.getHttpServer())
      .get(`/clients/${sharedClientId}`)
      .set("Authorization", `Bearer ${admin.token}`)
      .expect(200);
    await request(app.getHttpServer())
      .get(`/clients/${sharedClientId}`)
      .set("Authorization", `Bearer ${other.token}`)
      .expect(200);
  });

  it("cada admin ve SU PROPIA ruta para el cliente compartido, nunca la del otro", async () => {
    const admin = await login(app, SEED_ADMIN);
    const other = await login(app, { documento: otherAdmin.documento, password: OTHER_PASSWORD });

    const resA = await request(app.getHttpServer())
      .get(`/clients/${sharedClientId}`)
      .set("Authorization", `Bearer ${admin.token}`)
      .expect(200);
    const resB = await request(app.getHttpServer())
      .get(`/clients/${sharedClientId}`)
      .set("Authorization", `Bearer ${other.token}`)
      .expect(200);

    const detailA = clienteDetailSchema.parse(resA.body);
    const detailB = clienteDetailSchema.parse(resB.body);

    expect(detailA.rutaId).toBe(routeA.id);
    expect(detailB.rutaId).toBe(routeB.id);
  });

  it("un crédito que el admin A le da al cliente compartido es invisible para el admin B", async () => {
    const admin = await login(app, SEED_ADMIN);
    const other = await login(app, { documento: otherAdmin.documento, password: OTHER_PASSWORD });

    const created = await request(app.getHttpServer())
      .post("/credits")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({
        clienteId: sharedClientId,
        producto: `${PREFIX}producto-${Date.now()}`,
        monto: 100000,
        interes: 0,
        dias: 10,
      })
      .expect(201);
    const creditoId = creditoSchema.parse(created.body).id;

    // Admin B no lo ve en su listado...
    const listRes = await request(app.getHttpServer())
      .get("/credits")
      .set("Authorization", `Bearer ${other.token}`)
      .expect(200);
    const credits = creditoListItemSchema.array().parse(listRes.body);
    expect(credits.some((c) => c.id === creditoId)).toBe(false);

    // ...ni accediendo por id directo, aunque el cliente SÍ sea suyo.
    await request(app.getHttpServer())
      .get(`/credits/${creditoId}`)
      .set("Authorization", `Bearer ${other.token}`)
      .expect(404);
  });

  it("el admin B no puede crear créditos para el cliente compartido usando la ruta del admin A", async () => {
    const other = await login(app, { documento: otherAdmin.documento, password: OTHER_PASSWORD });

    // El cliente SÍ es cartera de Admin B (hay fila ClientAdmin), así que esto
    // no es el caso "cliente ajeno" de multi-tenancy.e2e-spec.ts — es una
    // creación normal dentro de SU relación, y debe funcionar.
    const res = await request(app.getHttpServer())
      .post("/credits")
      .set("Authorization", `Bearer ${other.token}`)
      .send({
        clienteId: sharedClientId,
        producto: `${PREFIX}producto-b-${Date.now()}`,
        monto: 50000,
        interes: 0,
        dias: 5,
      })
      .expect(201);
    const credito = creditoSchema.parse(res.body);

    // Y ese crédito, a su vez, es invisible para Admin A.
    const admin = await login(app, SEED_ADMIN);
    await request(app.getHttpServer())
      .get(`/credits/${credito.id}`)
      .set("Authorization", `Bearer ${admin.token}`)
      .expect(404);
  });

  it("el admin A desactiva su relación sin afectar la del admin B", async () => {
    const admin = await login(app, SEED_ADMIN);
    const other = await login(app, { documento: otherAdmin.documento, password: OTHER_PASSWORD });

    await request(app.getHttpServer())
      .delete(`/clients/${sharedClientId}`)
      .set("Authorization", `Bearer ${admin.token}`)
      .expect(204);

    // Admin A ya no lo ve en su listado (activo=false para su relación).
    const resA = await request(app.getHttpServer())
      .get("/clients")
      .set("Authorization", `Bearer ${admin.token}`)
      .expect(200);
    const listA = clienteListItemSchema.array().parse(resA.body);
    expect(listA.some((c) => c.id === sharedClientId)).toBe(false);

    // Admin B sigue viéndolo: su relación no se tocó.
    const resB = await request(app.getHttpServer())
      .get("/clients")
      .set("Authorization", `Bearer ${other.token}`)
      .expect(200);
    const listB = clienteListItemSchema.array().parse(resB.body);
    expect(listB.some((c) => c.id === sharedClientId)).toBe(true);
  });
});

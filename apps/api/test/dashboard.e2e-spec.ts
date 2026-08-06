import "dotenv/config";
import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { App } from "supertest/types";
import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient } from "@prisma/client";
import { dashboardSummarySchema, loginResponseSchema } from "@repo/types";
import { AppModule } from "../src/app.module";
import { seedAdminId } from "./helpers/tenant";

const ADMIN = { documento: "1000000001", password: "admin123" };
const COLLECTOR_A = { documento: "1000000002", password: "cobrador123" };
const ROUTE_PREFIX = "Dashboard E2E";
const PRODUCTO_NOMBRE = "Producto Dashboard E2E";

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

const DIA_MS = 24 * 60 * 60 * 1000;
function diasAtras(n: number): Date {
  return new Date(Date.now() - n * DIA_MS);
}

describe("DashboardController (e2e)", () => {
  let app: INestApplication<App>;
  let route: { id: string };
  let clienteId: string;

  beforeAll(async () => {
    const adminId = await seedAdminId(prisma);
    const collectorA = await prisma.usuario.findUniqueOrThrow({
      where: { documento: COLLECTOR_A.documento },
    });

    route = await prisma.ruta.create({
      data: { nombre: `${ROUTE_PREFIX} ${Date.now()}`, cobradorId: collectorA.id, adminId },
    });

    const cliente = await prisma.cliente.create({
      data: {
        nombre: "Cliente Dashboard E2E",
        telefono: "3000000000",
        documento: `dash-e2e-${Date.now()}`,
        direccion: "Test",
        admins: { create: { adminId, rutaId: route.id } },
      },
    });
    clienteId = cliente.id;

    const producto = await prisma.producto.upsert({
      where: { adminId_nombre: { adminId, nombre: PRODUCTO_NOMBRE } },
      update: {},
      create: { nombre: PRODUCTO_NOMBRE, precioBase: new Prisma.Decimal(50000), adminId },
    });

    // Cuota vencida hace 8 días, sin pago: al cerrar la ruta, este crédito
    // pasa a MORA y `clientsInArrears` debe reflejarlo.
    await prisma.credito.create({
      data: {
        codigo: `CR-DASH-${Date.now()}`,
        clienteId: cliente.id,
        productoId: producto.id,
        adminId,
        monto: new Prisma.Decimal(100000),
        interes: new Prisma.Decimal(0),
        cuotas: 10,
        dias: 10,
        montoTotal: new Prisma.Decimal(100000),
        cuotaDiaria: new Prisma.Decimal(10000),
        saldoPendiente: new Prisma.Decimal(100000),
        estado: "ACTIVO",
        fechaInicio: diasAtras(9),
      },
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
    await prisma.dailyClosure.deleteMany({ where: { routeId: route.id } });
    const clientAdmins = await prisma.clientAdmin.findMany({
      where: { rutaId: route.id },
      select: { clientId: true },
    });
    const clienteIds = clientAdmins.map((ca) => ca.clientId);
    await prisma.pago.deleteMany({ where: { credito: { clienteId: { in: clienteIds } } } });
    await prisma.credito.deleteMany({ where: { clienteId: { in: clienteIds } } });
    await prisma.clientAdmin.deleteMany({ where: { clientId: { in: clienteIds } } });
    await prisma.cliente.deleteMany({ where: { id: { in: clienteIds } } });
    await prisma.ruta.deleteMany({ where: { id: route.id } });
    await prisma.$disconnect();
  });

  it("responde 403 para un COBRADOR (el dashboard es solo ADMIN)", async () => {
    const collector = await login(app, COLLECTOR_A);
    await request(app.getHttpServer())
      .get("/dashboard/summary")
      .set("Authorization", `Bearer ${collector.token}`)
      .expect(403);
  });

  it("ADMIN ve el resumen con la forma correcta y 7 puntos semanales", async () => {
    const admin = await login(app, ADMIN);
    const res = await request(app.getHttpServer())
      .get("/dashboard/summary")
      .set("Authorization", `Bearer ${admin.token}`)
      .expect(200);

    const summary = dashboardSummarySchema.parse(res.body);
    expect(summary.weeklyCollections).toHaveLength(7);
    expect(summary.routesToday.some((r) => r.id === route.id)).toBe(true);
    const ruta = summary.routesToday.find((r) => r.id === route.id)!;
    expect(ruta.estadoDia).toBe("abierta");
  });

  it("tras cerrar la ruta, openRoutes baja en 1 y clientsInArrears sube (MORA materializada)", async () => {
    const admin = await login(app, ADMIN);

    const before = dashboardSummarySchema.parse(
      (
        await request(app.getHttpServer())
          .get("/dashboard/summary")
          .set("Authorization", `Bearer ${admin.token}`)
          .expect(200)
      ).body,
    );

    await request(app.getHttpServer())
      .post(`/daily-closures/${route.id}`)
      .set("Authorization", `Bearer ${admin.token}`)
      .expect(201);

    const after = dashboardSummarySchema.parse(
      (
        await request(app.getHttpServer())
          .get("/dashboard/summary")
          .set("Authorization", `Bearer ${admin.token}`)
          .expect(200)
      ).body,
    );

    expect(after.openRoutes).toBe(before.openRoutes - 1);
    expect(after.clientsInArrears).toBeGreaterThan(before.clientsInArrears);

    const rutaCerrada = after.routesToday.find((r) => r.id === route.id)!;
    expect(rutaCerrada.estadoDia).toBe("cerrada");

    const creditoEnDb = await prisma.credito.findFirstOrThrow({ where: { clienteId } });
    expect(creditoEnDb.estado).toBe("MORA");
  });
});

import "dotenv/config";
import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { App } from "supertest/types";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { creditoListItemSchema, loginResponseSchema } from "@repo/types";
import { AppModule } from "../src/app.module";
import { seedAdminId } from "./helpers/tenant";

// Frecuencia de pago (diaria/semanal/mensual). Lo que se verifica acá es la
// DERIVACIÓN del crédito, que es donde estaba el riesgo: el monto de la cuota
// sale de `montoTotal / cuotas` sin importar la frecuencia, y lo único que
// cambia con ella es el plazo nominal (`dias`).

const ADMIN = { documento: "1000000001", password: "admin123" };
const ROUTE_PREFIX = "Creditos E2E";

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

describe("CreditosController (e2e) — frecuencia de pago", () => {
  let app: INestApplication<App>;
  let clienteId: string;
  let productoNombre: string;

  beforeAll(async () => {
    const adminId = await seedAdminId(prisma);
    const ruta = await prisma.ruta.create({
      data: { nombre: `${ROUTE_PREFIX} ${Date.now()}`, adminId },
    });
    const cliente = await prisma.cliente.create({
      data: {
        nombre: "Cliente Creditos E2E",
        telefono: "3000000000",
        documento: `creditos-e2e-${Date.now()}`,
        direccion: "Test",
        admins: { create: { adminId, rutaId: ruta.id } },
      },
    });
    clienteId = cliente.id;
    productoNombre = `${ROUTE_PREFIX} producto ${Date.now()}`;
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
    const clientAdmins = await prisma.clientAdmin.findMany({
      where: { rutaId: { in: routeIds } },
      select: { clientId: true },
    });
    const clienteIds = clientAdmins.map((ca) => ca.clientId);
    await prisma.pago.deleteMany({ where: { credito: { clienteId: { in: clienteIds } } } });
    await prisma.credito.deleteMany({ where: { clienteId: { in: clienteIds } } });
    await prisma.clientAdmin.deleteMany({ where: { clientId: { in: clienteIds } } });
    await prisma.cliente.deleteMany({ where: { id: { in: clienteIds } } });
    await prisma.producto.deleteMany({ where: { nombre: { startsWith: ROUTE_PREFIX } } });
    await prisma.ruta.deleteMany({ where: { id: { in: routeIds } } });
    await prisma.$disconnect();
  });

  async function crear(body: Record<string, unknown>) {
    const admin = await login(app, ADMIN);
    const res = await request(app.getHttpServer())
      .post("/credits")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ clienteId, producto: productoNombre, ...body })
      .expect(201);
    return creditoListItemSchema.parse(res.body);
  }

  it("un body sin `frecuencia` crea un crédito DIARIO (comportamiento histórico)", async () => {
    const credito = await crear({ monto: 100_000, interes: 20, cuotas: 30 });

    expect(credito.frecuencia).toBe("DIARIO");
    expect(credito.cuotasTotal).toBe(30);
    // 100.000 + 20% = 120.000 ; /30 = 4.000 por cuota.
    expect(credito.montoTotal).toBe(120_000);
    expect(credito.cuotaDiaria).toBe(4_000);
    // En diario el plazo nominal coincide con el número de cuotas.
    expect(credito.dias).toBe(30);
    expect(credito.saldoPendiente).toBe(120_000);
  });

  it("SEMANAL: la cuota es total/cuotas y el plazo nominal son 7 días por cuota", async () => {
    // El ejemplo del negocio: 1.000.000 + 20% = 1.200.000 en 4 semanas →
    // 300.000 por semana.
    const credito = await crear({
      monto: 1_000_000,
      interes: 20,
      frecuencia: "SEMANAL",
      cuotas: 4,
    });

    expect(credito.frecuencia).toBe("SEMANAL");
    expect(credito.montoTotal).toBe(1_200_000);
    expect(credito.cuotaDiaria).toBe(300_000);
    expect(credito.cuotasTotal).toBe(4);
    expect(credito.dias).toBe(28);
  });

  it("MENSUAL: mismo cálculo de dinero, plazo nominal de 30 días por cuota", async () => {
    const credito = await crear({
      monto: 600_000,
      interes: 0,
      frecuencia: "MENSUAL",
      cuotas: 6,
    });

    expect(credito.frecuencia).toBe("MENSUAL");
    expect(credito.montoTotal).toBe(600_000);
    expect(credito.cuotaDiaria).toBe(100_000);
    expect(credito.dias).toBe(180);
  });

  it("rechaza una frecuencia desconocida", async () => {
    const admin = await login(app, ADMIN);
    await request(app.getHttpServer())
      .post("/credits")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({
        clienteId,
        producto: productoNombre,
        monto: 100_000,
        interes: 0,
        frecuencia: "QUINCENAL",
        cuotas: 4,
      })
      .expect(400);
  });

  it("cambiar la frecuencia recalcula el plazo nominal sin tocar el valor de la cuota", async () => {
    const admin = await login(app, ADMIN);
    const credito = await crear({
      monto: 400_000,
      interes: 0,
      frecuencia: "DIARIO",
      cuotas: 4,
    });
    expect(credito.dias).toBe(4);

    const res = await request(app.getHttpServer())
      .patch(`/credits/${credito.id}`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ frecuencia: "SEMANAL" })
      .expect(200);

    const actualizado = creditoListItemSchema.parse(res.body);
    expect(actualizado.frecuencia).toBe("SEMANAL");
    // La cuota no cambia (mismo total, mismas 4 cuotas); el plazo sí.
    expect(actualizado.cuotaDiaria).toBe(100_000);
    expect(actualizado.dias).toBe(28);
  });
});

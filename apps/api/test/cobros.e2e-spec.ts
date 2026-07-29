import "dotenv/config";
import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { App } from "supertest/types";
import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient } from "@prisma/client";
import { cobroResponseSchema, loginResponseSchema, rutaDetailSchema } from "@repo/types";
import { AppModule } from "../src/app.module";
import { seedAdminId } from "./helpers/tenant";

const ADMIN = { documento: "1000000001", password: "admin123" };
const COLLECTOR_A = { documento: "1000000002", password: "cobrador123" };
const ROUTE_PREFIX = "Cobros E2E";
const PRODUCTO_NOMBRE = "Producto Cobros E2E";

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

describe("CobrosController (e2e)", () => {
  let app: INestApplication<App>;
  let routeA: { id: string };
  let clienteId: string;
  let creditoId: string;
  let segundoCreditoId: string;

  beforeAll(async () => {
    const adminId = await seedAdminId(prisma);
    const collectorA = await prisma.usuario.findUniqueOrThrow({
      where: { documento: COLLECTOR_A.documento },
    });
    routeA = await prisma.ruta.create({
      data: { nombre: `${ROUTE_PREFIX} ${Date.now()}`, cobradorId: collectorA.id, adminId },
    });
    const cliente = await prisma.cliente.create({
      data: {
        nombre: "Cliente Cobros E2E",
        telefono: "3000000000",
        documento: `cobros-e2e-${Date.now()}`,
        direccion: "Test",
        admins: { create: { adminId, rutaId: routeA.id } },
      },
    });
    clienteId = cliente.id;
    const producto = await prisma.producto.upsert({
      where: { adminId_nombre: { adminId, nombre: PRODUCTO_NOMBRE } },
      update: {},
      create: { nombre: PRODUCTO_NOMBRE, precioBase: new Prisma.Decimal(100000), adminId },
    });
    // Dos créditos ACTIVOS del mismo cliente: el escenario que rompía el total
    // del día (un pago en cada uno el mismo día).
    const crear = (codigo: string) =>
      prisma.credito.create({
        data: {
          codigo,
          clienteId: cliente.id,
          productoId: producto.id,
          adminId,
          monto: new Prisma.Decimal(100000),
          interes: new Prisma.Decimal(0),
          dias: 10,
          montoTotal: new Prisma.Decimal(100000),
          cuotaDiaria: new Prisma.Decimal(10000),
          saldoPendiente: new Prisma.Decimal(100000),
          estado: "ACTIVO",
        },
      });
    creditoId = (await crear(`CR-CBR-A-${Date.now()}`)).id;
    segundoCreditoId = (await crear(`CR-CBR-B-${Date.now()}`)).id;
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
    // La ruta ahora vive en ClientAdmin (relación cliente↔admin), no en
    // Cliente: hay que resolver los clientId por ahí, y borrar esa fila antes
    // que el Cliente y la Ruta (ambos FK Restrict desde ClientAdmin).
    const clientAdmins = await prisma.clientAdmin.findMany({
      where: { rutaId: { in: routeIds } },
      select: { clientId: true },
    });
    const clienteIds = clientAdmins.map((ca) => ca.clientId);
    await prisma.pago.deleteMany({ where: { credito: { clienteId: { in: clienteIds } } } });
    await prisma.credito.deleteMany({ where: { clienteId: { in: clienteIds } } });
    await prisma.clientAdmin.deleteMany({ where: { clientId: { in: clienteIds } } });
    await prisma.cliente.deleteMany({ where: { id: { in: clienteIds } } });
    await prisma.ruta.deleteMany({ where: { id: { in: routeIds } } });
    await prisma.$disconnect();
  });

  // Regresión del bug de producción: el pago se guardaba pero la respuesta
  // reventaba con `TypeError: Cannot read properties of undefined (reading
  // '_parse')` porque un import circular en `@repo/types` dejaba
  // `cobroResponseSchema.shape.credito` en `undefined`. El síntoma para el
  // cobrador era un toast de "Internal server error" con el cobro ya aplicado.
  it("registra el cobro y devuelve 201 con la respuesta completa (no 500)", async () => {
    const collector = await login(app, COLLECTOR_A);

    const res = await request(app.getHttpServer())
      .post("/collections")
      .set("Authorization", `Bearer ${collector.token}`)
      .send({ creditoId, monto: 10000 })
      .expect(201);

    // `.parse` (no `safeParse`): si el schema vuelve a romperse, este test
    // falla con el mismo TypeError que veía el usuario.
    const body = cobroResponseSchema.parse(res.body);
    expect(body.pago.monto).toBe(10000);
    expect(body.credito.saldoPendiente).toBe(90000);
    expect(body.recibo.codigo).toMatch(/^R-/);
    // El enlace compartible por WhatsApp.
    expect(body.recibo.publicUrl).toContain("/r/");
  });

  it("el enlace publicUrl del cobro abre el recibo sin autenticación", async () => {
    const collector = await login(app, COLLECTOR_A);
    const res = await request(app.getHttpServer())
      .post("/collections")
      .set("Authorization", `Bearer ${collector.token}`)
      .send({ creditoId, monto: 5000 })
      .expect(201);

    const { publicUrl } = cobroResponseSchema.parse(res.body).recibo;
    const path = new URL(publicUrl!).pathname;

    const receipt = await request(app.getHttpServer()).get(path).expect(200);
    expect(receipt.text).toContain("<!doctype html>");
  });

  // El bug de "Cobrado hoy": `summarizeRuta` se quedaba con UN solo pago por
  // cliente (el más reciente) y sumaba esos, así que los abonos anteriores del
  // día desaparecían del total.
  it("suma TODOS los pagos del día del cliente en totalCobradoHoy", async () => {
    const collector = await login(app, COLLECTOR_A);

    const pagar = (id: string, monto: number) =>
      request(app.getHttpServer())
        .post("/collections")
        .set("Authorization", `Bearer ${collector.token}`)
        .send({ creditoId: id, monto })
        .expect(201);

    // Dos abonos hoy: uno en cada crédito del mismo cliente.
    await pagar(creditoId, 7000);
    await pagar(segundoCreditoId, 3000);

    const admin = await login(app, ADMIN);
    const res = await request(app.getHttpServer())
      .get(`/routes/${routeA.id}`)
      .set("Authorization", `Bearer ${admin.token}`)
      .expect(200);

    const ruta = rutaDetailSchema.parse(res.body);
    const cliente = ruta.clientes.find((c) => c.id === clienteId);
    expect(cliente).toBeDefined();

    // Lo cobrado hoy a este cliente en TODA la corrida del suite.
    const pagosDeHoy = await prisma.pago.aggregate({
      where: { credito: { clienteId } },
      _sum: { monto: true },
    });
    const esperado = Number(pagosDeHoy._sum.monto?.toString() ?? "0");

    expect(cliente!.totalCobradoHoy).toBeCloseTo(esperado, 2);
    // Y el total de la ruta refleja esa misma suma (antes se quedaba corto).
    expect(ruta.cobradoHoy).toBeCloseTo(esperado, 2);
    // El bug concreto: con dos créditos pagados hoy, el total NO puede ser
    // igual al último pago suelto.
    expect(cliente!.totalCobradoHoy).toBeGreaterThan(cliente!.cobroHoy!.monto);
  });
});

import "dotenv/config";
import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { App } from "supertest/types";
import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";
import {
  clientCreditDetailSchema,
  clientCreditListItemSchema,
  clientCreditSummarySchema,
  clientLoginResponseSchema,
  loginResponseSchema,
} from "@repo/types";
import { AppModule } from "../src/app.module";

const ADMIN = { documento: "1000000001", password: "admin123" };
const COBRADOR_DOCUMENTO = "1000000002";
const PLAIN_PASSWORD = "clienteE2e123";
const DOCUMENTO_PREFIX = "client-portal-e2e-";
const PRODUCTO_NOMBRE = "Producto Portal E2E";
const DIA_MS = 24 * 60 * 60 * 1000;

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

let counter = 0;
function uniqueDocumento(): string {
  counter += 1;
  return `${DOCUMENTO_PREFIX}${Date.now()}-${counter}`;
}

async function createCliente(overrides: Record<string, unknown> = {}) {
  return prisma.cliente.create({
    data: {
      nombre: "Cliente Portal E2E",
      telefono: "3000000000",
      documento: uniqueDocumento(),
      direccion: "Test",
      passwordHash: await bcrypt.hash(PLAIN_PASSWORD, 10),
      mustChangePassword: false,
      ...overrides,
    },
  });
}

// Crédito con historial mixto a propósito: cuota 1 pagada el día esperado
// (ON_TIME), cuota 2 pagada 1 día tarde (LATE), y cuota 3 todavía sin pagar
// (MISSED) — ejercita los 3 estados de `buildPaymentHistory` con datos reales.
async function createCreditoConHistorialMixto(clienteId: string, cobradorId: string) {
  const producto = await prisma.producto.upsert({
    where: { nombre: PRODUCTO_NOMBRE },
    update: {},
    create: { nombre: PRODUCTO_NOMBRE, precioBase: new Prisma.Decimal(300000) },
  });

  const fechaInicio = new Date(Date.now() - 2 * DIA_MS);
  const credito = await prisma.credito.create({
    data: {
      codigo: `CR-E2E-${Date.now()}-${counter}`,
      clienteId,
      productoId: producto.id,
      monto: new Prisma.Decimal(300000),
      interes: new Prisma.Decimal(0),
      dias: 30,
      montoTotal: new Prisma.Decimal(300000),
      cuotaDiaria: new Prisma.Decimal(10000),
      saldoPendiente: new Prisma.Decimal(280000),
      estado: "ACTIVO",
      fechaInicio,
    },
  });

  const pagoOnTime = await prisma.pago.create({
    data: {
      creditoId: credito.id,
      monto: new Prisma.Decimal(10000),
      cobradorId,
      fecha: fechaInicio,
    },
  });
  await prisma.pago.create({
    data: {
      creditoId: credito.id,
      monto: new Prisma.Decimal(10000),
      cobradorId,
      fecha: new Date(Date.now()), // día 2, esperado día 1 → LATE
    },
  });

  return { credito, pagoOnTimeId: pagoOnTime.id };
}

describe("ClientPortalController (e2e)", () => {
  let app: INestApplication<App>;
  let cobradorId: string;

  beforeAll(async () => {
    const cobrador = await prisma.usuario.findUniqueOrThrow({
      where: { documento: COBRADOR_DOCUMENTO },
    });
    cobradorId = cobrador.id;
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
    const clientes = await prisma.cliente.findMany({
      where: { documento: { startsWith: DOCUMENTO_PREFIX } },
      select: { id: true },
    });
    const clienteIds = clientes.map((c) => c.id);
    await prisma.pago.deleteMany({ where: { credito: { clienteId: { in: clienteIds } } } });
    await prisma.credito.deleteMany({ where: { clienteId: { in: clienteIds } } });
    await prisma.cliente.deleteMany({ where: { id: { in: clienteIds } } });
    await prisma.$disconnect();
  });

  async function loginCliente(documento: string) {
    const res = await request(app.getHttpServer())
      .post("/client-auth/login")
      .send({ documento, password: PLAIN_PASSWORD })
      .expect(200);
    return clientLoginResponseSchema.parse(res.body).token;
  }

  it("GET /client-portal/credits devuelve la lista con proximaFechaCuota", async () => {
    const cliente = await createCliente();
    await createCreditoConHistorialMixto(cliente.id, cobradorId);
    const token = await loginCliente(cliente.documento);

    const res = await request(app.getHttpServer())
      .get("/client-portal/credits")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    const credits = clientCreditListItemSchema.array().parse(res.body);
    expect(credits).toHaveLength(1);
    expect(credits[0]!.proximaFechaCuota).not.toBeNull();
  });

  it("GET /client-portal/credits/:id responde 404 para un crédito ajeno", async () => {
    const clienteA = await createCliente();
    const clienteB = await createCliente();
    const { credito } = await createCreditoConHistorialMixto(clienteB.id, cobradorId);
    const tokenA = await loginCliente(clienteA.documento);

    await request(app.getHttpServer())
      .get(`/client-portal/credits/${credito.id}`)
      .set("Authorization", `Bearer ${tokenA}`)
      .expect(404);
  });

  it("GET /client-portal/credits/:id enriquece pagos con numeroCuota correlativo y estados mixtos", async () => {
    const cliente = await createCliente();
    const { credito } = await createCreditoConHistorialMixto(cliente.id, cobradorId);
    const token = await loginCliente(cliente.documento);

    const res = await request(app.getHttpServer())
      .get(`/client-portal/credits/${credito.id}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    const detail = clientCreditDetailSchema.parse(res.body);
    const numeros = detail.pagos.map((p) => p.numeroCuota).sort((a, b) => a - b);
    expect(numeros).toEqual([1, 2, 3]);
    expect(detail.pagos.some((p) => p.estado === "ON_TIME")).toBe(true);
    expect(detail.pagos.some((p) => p.estado === "LATE")).toBe(true);
  });

  it("GET /client-portal/credits/:id incluye filas sintéticas sin pagar con monto 0", async () => {
    const cliente = await createCliente();
    const { credito } = await createCreditoConHistorialMixto(cliente.id, cobradorId);
    const token = await loginCliente(cliente.documento);

    const res = await request(app.getHttpServer())
      .get(`/client-portal/credits/${credito.id}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    const detail = clientCreditDetailSchema.parse(res.body);
    // Las cuotas sin pagar escalan con el tiempo (PENDING → OVERDUE →
    // DEFAULTED); lo común a las tres es que no hay `Pago` detrás.
    const sinPagar = detail.pagos.filter(
      (p) => p.estado === "PENDING" || p.estado === "OVERDUE" || p.estado === "DEFAULTED",
    );
    expect(sinPagar.length).toBeGreaterThan(0);
    expect(sinPagar.every((p) => p.monto === 0 && p.reciboCodigo === null)).toBe(true);
    // Sin pagar ⇒ sin fecha de pago, pero SIEMPRE con fecha de vencimiento.
    expect(sinPagar.every((p) => p.fechaPago === null && !!p.fechaVencimiento)).toBe(true);
  });

  it("las cuotas pagadas traen fechaPago y fechaVencimiento por separado", async () => {
    const cliente = await createCliente();
    const { credito } = await createCreditoConHistorialMixto(cliente.id, cobradorId);
    const token = await loginCliente(cliente.documento);

    const res = await request(app.getHttpServer())
      .get(`/client-portal/credits/${credito.id}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    const detail = clientCreditDetailSchema.parse(res.body);
    const pagadas = detail.pagos.filter((p) => p.estado === "ON_TIME" || p.estado === "LATE");
    expect(pagadas.length).toBeGreaterThan(0);
    expect(pagadas.every((p) => p.fechaPago !== null)).toBe(true);

    // El dato que motivó separar las columnas: en una cuota LATE la fecha de
    // pago es POSTERIOR a la de vencimiento, y `diasAtraso` lo cuantifica.
    const late = pagadas.find((p) => p.estado === "LATE");
    expect(late).toBeDefined();
    expect(late!.diasAtraso).toBeGreaterThan(0);
    expect(new Date(late!.fechaPago!).getTime()).toBeGreaterThan(
      new Date(late!.fechaVencimiento).getTime(),
    );
  });

  it("GET /client-portal/credits responde 428 si mustChangePassword=true", async () => {
    const cliente = await createCliente({ mustChangePassword: true });
    const token = await loginCliente(cliente.documento);

    const res = await request(app.getHttpServer())
      .get("/client-portal/credits")
      .set("Authorization", `Bearer ${token}`)
      .expect(428);

    const body = res.body as { code?: string };
    expect(body.code).toBe("MUST_CHANGE_PASSWORD");
  });

  it("POST /client-auth/change-password funciona aunque mustChangePassword=true (la excepción a la regla)", async () => {
    const cliente = await createCliente({ mustChangePassword: true });
    const token = await loginCliente(cliente.documento);

    await request(app.getHttpServer())
      .post("/client-auth/change-password")
      .set("Authorization", `Bearer ${token}`)
      .send({ currentPassword: PLAIN_PASSWORD, newPassword: "otraClaveNueva1" })
      .expect(200);
  });

  it("GET /client-portal/summary responde 200 con el shape correcto", async () => {
    const cliente = await createCliente();
    await createCreditoConHistorialMixto(cliente.id, cobradorId);
    const token = await loginCliente(cliente.documento);

    const res = await request(app.getHttpServer())
      .get("/client-portal/summary")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    const summary = clientCreditSummarySchema.parse(res.body);
    expect(summary.creditosActivos).toBe(1);
  });

  it("GET /client-portal/payments/:pagoId/receipt responde 200 + HTML para un pago propio", async () => {
    const cliente = await createCliente();
    const { pagoOnTimeId } = await createCreditoConHistorialMixto(cliente.id, cobradorId);
    const token = await loginCliente(cliente.documento);

    const res = await request(app.getHttpServer())
      .get(`/client-portal/payments/${pagoOnTimeId}/receipt`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(res.text).toContain("<!doctype html>");
  });

  it("GET /client-portal/payments/:pagoId/receipt responde 404 para un pago de otro cliente", async () => {
    const clienteA = await createCliente();
    const clienteB = await createCliente();
    const { pagoOnTimeId } = await createCreditoConHistorialMixto(clienteB.id, cobradorId);
    const tokenA = await loginCliente(clienteA.documento);

    await request(app.getHttpServer())
      .get(`/client-portal/payments/${pagoOnTimeId}/receipt`)
      .set("Authorization", `Bearer ${tokenA}`)
      .expect(404);
  });

  it("un staff (ADMIN) recibe 403 al usar un endpoint del portal", async () => {
    const login = await request(app.getHttpServer()).post("/auth/login").send(ADMIN).expect(200);
    const { token } = loginResponseSchema.parse(login.body);

    await request(app.getHttpServer())
      .get("/client-portal/credits")
      .set("Authorization", `Bearer ${token}`)
      .expect(403);
  });
});

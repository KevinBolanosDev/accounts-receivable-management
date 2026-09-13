import "dotenv/config";
import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { App } from "supertest/types";
import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient } from "@prisma/client";
import { loginResponseSchema } from "@repo/types";
import { AppModule } from "../src/app.module";
import { seedAdminId } from "./helpers/tenant";
import { ReceiptTokenService } from "../src/core/receipts/receipt-token.service";

const ADMIN = { documento: "1000000001", password: "admin123" };
const COLLECTOR_A = { documento: "1000000002", password: "cobrador123" };
const COLLECTOR_B = { documento: "1000000003", password: "cobrador123" };
const ROUTE_PREFIX = "Receipts E2E";
const PRODUCTO_NOMBRE = "Producto Receipts E2E";

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

// El recibo se sirve como `application/pdf`. Mismo patrón de aserción que
// `daily-closures.e2e-spec.ts` para el PDF del cierre: supertest deja el cuerpo
// en `body` (Buffer) o en `text` según cómo haya negociado el parseo, así que
// se normaliza antes de mirar la firma `%PDF-`.
function expectPdf(res: request.Response): void {
  expect(res.headers["content-type"]).toContain("application/pdf");
  const bytes = Buffer.isBuffer(res.body) ? res.body : Buffer.from(res.text ?? "", "binary");
  expect(bytes.subarray(0, 5).toString("latin1")).toBe("%PDF-");
}

describe("ReceiptsController (e2e)", () => {
  let app: INestApplication<App>;
  let routeA: { id: string };
  let pagoId: string;

  beforeAll(async () => {
    await prisma.cliente.deleteMany({ where: { documento: { startsWith: "receipts-e2e-" } } });
    const adminId = await seedAdminId(prisma);
    const collectorA = await prisma.usuario.findUniqueOrThrow({
      where: { documento: COLLECTOR_A.documento },
    });
    routeA = await prisma.ruta.create({
      data: { nombre: `${ROUTE_PREFIX} ${Date.now()}`, cobradorId: collectorA.id, adminId },
    });
    const cliente = await prisma.cliente.create({
      data: {
        nombre: "Cliente Receipts E2E",
        telefono: "3000000000",
        documento: `receipts-e2e-${Date.now()}`,
        direccion: "Test",
        admins: { create: { adminId, rutaId: routeA.id } },
      },
    });
    const producto = await prisma.producto.upsert({
      where: { adminId_nombre: { adminId, nombre: PRODUCTO_NOMBRE } },
      update: {},
      create: { nombre: PRODUCTO_NOMBRE, precioBase: new Prisma.Decimal(100000), adminId },
    });
    const credito = await prisma.credito.create({
      data: {
        codigo: `CR-RCP-${Date.now()}`,
        clienteId: cliente.id,
        productoId: producto.id,
        adminId,
        monto: new Prisma.Decimal(100000),
        interes: new Prisma.Decimal(0),
        cuotas: 10,
        dias: 10,
        montoTotal: new Prisma.Decimal(100000),
        cuotaDiaria: new Prisma.Decimal(10000),
        saldoPendiente: new Prisma.Decimal(90000),
        estado: "ACTIVO",
      },
    });
    const pago = await prisma.pago.create({
      data: { creditoId: credito.id, monto: new Prisma.Decimal(10000), cobradorId: collectorA.id },
    });
    pagoId = pago.id;
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

  it("responde 200 + PDF para un ADMIN", async () => {
    const admin = await login(app, ADMIN);
    const res = await request(app.getHttpServer())
      .get(`/payments/${pagoId}/receipt`)
      .set("Authorization", `Bearer ${admin.token}`)
      .expect(200);
    expectPdf(res);
  });

  it("responde 200 + PDF para el COBRADOR de la ruta del cliente", async () => {
    const collector = await login(app, COLLECTOR_A);
    const res = await request(app.getHttpServer())
      .get(`/payments/${pagoId}/receipt`)
      .set("Authorization", `Bearer ${collector.token}`)
      .expect(200);
    expectPdf(res);
  });

  it("responde 403 para un COBRADOR de otra ruta", async () => {
    const collector = await login(app, COLLECTOR_B);
    await request(app.getHttpServer())
      .get(`/payments/${pagoId}/receipt`)
      .set("Authorization", `Bearer ${collector.token}`)
      .expect(403);
  });

  it("responde 401 sin token", () => {
    return request(app.getHttpServer()).get(`/payments/${pagoId}/receipt`).expect(401);
  });

  it("responde 404 si el pago no existe", async () => {
    const admin = await login(app, ADMIN);
    await request(app.getHttpServer())
      .get("/payments/00000000-0000-0000-0000-000000000000/receipt")
      .set("Authorization", `Bearer ${admin.token}`)
      .expect(404);
  });

  // === Enlace público firmado (`GET /r/:token`) =============================
  // Es lo que se comparte por WhatsApp: el cliente que lo abre no tiene JWT de
  // staff, así que el recibo TIENE que cargar sin Authorization.
  describe("GET /r/:token (enlace público)", () => {
    it("sirve el recibo SIN token de sesión", async () => {
      const admin = await login(app, ADMIN);
      // El enlace público se obtiene del propio detalle del cliente, igual que
      // lo hace el front — no se fabrica a mano en el test.
      const receiptRes = await request(app.getHttpServer())
        .get(`/payments/${pagoId}/receipt`)
        .set("Authorization", `Bearer ${admin.token}`)
        .expect(200);
      expectPdf(receiptRes);

      const token = app.get(ReceiptTokenService).sign(pagoId);

      const res = await request(app.getHttpServer()).get(`/r/${token}`).expect(200);
      expectPdf(res);
      expect(res.headers["x-robots-tag"]).toContain("noindex");
    });

    it("responde 401 con un token corrupto", async () => {
      await request(app.getHttpServer()).get("/r/no-es-un-jwt").expect(401);
    });

    // El chequeo que impide que un JWT de sesión (que NO lleva `typ: receipt`)
    // sirva como enlace de recibo, y viceversa.
    it("responde 401 con un JWT de sesión válido en vez de un token de recibo", async () => {
      const admin = await login(app, ADMIN);
      await request(app.getHttpServer()).get(`/r/${admin.token}`).expect(401);
    });
  });
});

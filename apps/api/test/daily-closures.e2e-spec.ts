import "dotenv/config";
import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { App } from "supertest/types";
import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient } from "@prisma/client";
import {
  closurePreviewSchema,
  cobroResponseSchema,
  dailyClosureListItemSchema,
  dailyClosureSchema,
  loginResponseSchema,
} from "@repo/types";
import { AppModule } from "../src/app.module";
import { seedAdminId } from "./helpers/tenant";

const ADMIN = { documento: "1000000001", password: "admin123" };
const COLLECTOR_A = { documento: "1000000002", password: "cobrador123" };
const COLLECTOR_B = { documento: "1000000003", password: "cobrador123" };
const ROUTE_PREFIX = "DailyClosures E2E";
const PRODUCTO_NOMBRE = "Producto DailyClosures E2E";

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

describe("DailyClosuresController (e2e)", () => {
  let app: INestApplication<App>;
  let routeA: { id: string };
  let routeB: { id: string };
  let clienteId: string;
  let creditoMoraId: string;
  let creditoPeriodoId: string;

  beforeAll(async () => {
    const adminId = await seedAdminId(prisma);
    const collectorA = await prisma.usuario.findUniqueOrThrow({
      where: { documento: COLLECTOR_A.documento },
    });
    const collectorB = await prisma.usuario.findUniqueOrThrow({
      where: { documento: COLLECTOR_B.documento },
    });

    routeA = await prisma.ruta.create({
      data: { nombre: `${ROUTE_PREFIX} A ${Date.now()}`, cobradorId: collectorA.id, adminId },
    });
    routeB = await prisma.ruta.create({
      data: { nombre: `${ROUTE_PREFIX} B ${Date.now()}`, cobradorId: collectorB.id, adminId },
    });

    const cliente = await prisma.cliente.create({
      data: {
        nombre: "Cliente DailyClosures E2E",
        telefono: "3000000000",
        documento: `dc-e2e-${Date.now()}`,
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

    // fechaInicio hace 9 días ⇒ cuota 1 vence hace 8 días (9-1) ⇒ DEFAULTED
    // (7+ días) ⇒ debe pasar a MORA al cerrar la ruta.
    creditoMoraId = (
      await prisma.credito.create({
        data: {
          codigo: `CR-DCM-${Date.now()}`,
          clienteId: cliente.id,
          productoId: producto.id,
          adminId,
          monto: new Prisma.Decimal(300000),
          interes: new Prisma.Decimal(0),
          cuotas: 30,
          dias: 30,
          montoTotal: new Prisma.Decimal(300000),
          cuotaDiaria: new Prisma.Decimal(10000),
          saldoPendiente: new Prisma.Decimal(300000),
          estado: "ACTIVO",
          fechaInicio: diasAtras(9),
        },
      })
    ).id;

    // Otorgado HOY, sin pago — cuenta como "crédito nuevo" del cierre.
    await prisma.credito.create({
      data: {
        codigo: `CR-DCA-${Date.now()}`,
        clienteId: cliente.id,
        productoId: producto.id,
        adminId,
        monto: new Prisma.Decimal(200000),
        interes: new Prisma.Decimal(0),
        cuotas: 20,
        dias: 20,
        montoTotal: new Prisma.Decimal(200000),
        cuotaDiaria: new Prisma.Decimal(10000),
        saldoPendiente: new Prisma.Decimal(200000),
        estado: "ACTIVO",
        fechaInicio: new Date(),
      },
    });

    // Cliente/crédito PROPIO de routeB, separado del de arriba: el grupo de
    // pruebas de `paidClients`/`periodStart` registra cobros reales vía
    // `POST /collections` y no debe interferir con las aserciones de
    // `unpaidClients` sobre `clienteId` (que se rompería si ESE cliente
    // apareciera como "pagó hoy").
    const clienteB = await prisma.cliente.create({
      data: {
        nombre: "Cliente B DailyClosures E2E",
        telefono: "3000000001",
        documento: `dc-e2e-b-${Date.now()}`,
        direccion: "Test",
        admins: { create: { adminId, rutaId: routeB.id } },
      },
    });
    creditoPeriodoId = (
      await prisma.credito.create({
        data: {
          codigo: `CR-DCP-${Date.now()}`,
          clienteId: clienteB.id,
          productoId: producto.id,
          adminId,
          monto: new Prisma.Decimal(400000),
          interes: new Prisma.Decimal(0),
          cuotas: 40,
          dias: 40,
          montoTotal: new Prisma.Decimal(400000),
          cuotaDiaria: new Prisma.Decimal(10000),
          saldoPendiente: new Prisma.Decimal(400000),
          estado: "ACTIVO",
          fechaInicio: diasAtras(1),
        },
      })
    ).id;
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
    const routeIds = [routeA.id, routeB.id];
    await prisma.dailyClosure.deleteMany({ where: { routeId: { in: routeIds } } });
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

  describe("GET /daily-closures/preview/:routeId", () => {
    it("ADMIN ve el resumen en vivo del día, sin persistir (alreadyClosed=false)", async () => {
      const admin = await login(app, ADMIN);
      const res = await request(app.getHttpServer())
        .get(`/daily-closures/preview/${routeA.id}`)
        .set("Authorization", `Bearer ${admin.token}`)
        .expect(200);

      const preview = closurePreviewSchema.parse(res.body);
      expect(preview.routeId).toBe(routeA.id);
      expect(preview.alreadyClosed).toBe(false);
      expect(preview.newCredits).toBeGreaterThanOrEqual(1);
      expect(preview.unpaidClients.some((c) => c.clienteId === clienteId)).toBe(true);

      // No persiste: previsualizar dos veces no crea ningún DailyClosure.
      const count = await prisma.dailyClosure.count({ where: { routeId: routeA.id } });
      expect(count).toBe(0);
    });

    it("un COBRADOR de otra ruta no puede ver el preview (403)", async () => {
      const collectorB = await login(app, COLLECTOR_B);
      await request(app.getHttpServer())
        .get(`/daily-closures/preview/${routeA.id}`)
        .set("Authorization", `Bearer ${collectorB.token}`)
        .expect(403);
    });
  });

  describe("POST /daily-closures/:routeId (cerrar)", () => {
    it("un COBRADOR de otra ruta no puede cerrarla (403), y no queda nada creado", async () => {
      const collectorB = await login(app, COLLECTOR_B);
      await request(app.getHttpServer())
        .post(`/daily-closures/${routeA.id}`)
        .set("Authorization", `Bearer ${collectorB.token}`)
        .expect(403);

      const count = await prisma.dailyClosure.count({ where: { routeId: routeA.id } });
      expect(count).toBe(0);
    });

    it("el COBRADOR de la ruta cierra: 201 + snapshot, y materializa MORA atómicamente", async () => {
      const collectorA = await login(app, COLLECTOR_A);

      const res = await request(app.getHttpServer())
        .post(`/daily-closures/${routeA.id}`)
        .set("Authorization", `Bearer ${collectorA.token}`)
        .expect(201);

      const closure = dailyClosureSchema.parse(res.body);
      expect(closure.routeId).toBe(routeA.id);
      expect(closure.status).toBe("CLOSED");
      expect(closure.closedByNombre).toBeTruthy();
      expect(closure.unpaidClients.some((c) => c.clienteId === clienteId)).toBe(true);
      expect(closure.newCredits).toBeGreaterThanOrEqual(1);

      // La transacción marcó MORA de verdad en la base, no solo en la respuesta.
      const creditoEnDb = await prisma.credito.findUniqueOrThrow({ where: { id: creditoMoraId } });
      expect(creditoEnDb.estado).toBe("MORA");
    });

    it("recierre de la misma ruta el mismo día responde 409 (idempotencia)", async () => {
      const admin = await login(app, ADMIN);
      await request(app.getHttpServer())
        .post(`/daily-closures/${routeA.id}`)
        .set("Authorization", `Bearer ${admin.token}`)
        .expect(409);

      // Sigue habiendo un único cierre — el 409 no dejó una fila a medias.
      const count = await prisma.dailyClosure.count({ where: { routeId: routeA.id } });
      expect(count).toBe(1);
    });

    it("el preview de una ruta ya cerrada hoy responde alreadyClosed=true", async () => {
      const admin = await login(app, ADMIN);
      const res = await request(app.getHttpServer())
        .get(`/daily-closures/preview/${routeA.id}`)
        .set("Authorization", `Bearer ${admin.token}`)
        .expect(200);
      expect(closurePreviewSchema.parse(res.body).alreadyClosed).toBe(true);
    });
  });

  describe("paidClients y el pago tardío (periodStart)", () => {
    it("un pago registrado ANTES de cerrar aparece en paidClients con su numeroCuota", async () => {
      const collectorB = await login(app, COLLECTOR_B);

      const cobro = cobroResponseSchema.parse(
        (
          await request(app.getHttpServer())
            .post("/collections")
            .set("Authorization", `Bearer ${collectorB.token}`)
            .send({ creditoId: creditoPeriodoId, monto: 10000 })
            .expect(201)
        ).body,
      );
      expect(cobro.pago.creditoId).toBe(creditoPeriodoId);

      const closeRes = await request(app.getHttpServer())
        .post(`/daily-closures/${routeB.id}`)
        .set("Authorization", `Bearer ${collectorB.token}`)
        .expect(201);
      const closure = dailyClosureSchema.parse(closeRes.body);

      expect(closure.paidClients).toEqual([
        expect.objectContaining({ numeroCuota: 1, monto: 10000 }),
      ]);
      expect(closure.collectedCount).toBe(closure.paidClients?.length);
    });

    it("un pago registrado DESPUÉS de cerrar no se pierde: aparece en el preview del período siguiente, no en el cierre ya congelado", async () => {
      const collectorB = await login(app, COLLECTOR_B);
      const closureAntes = await prisma.dailyClosure.findFirstOrThrow({
        where: { routeId: routeB.id },
      });

      // El pago "tardío": llega después de que la ruta ya cerró hoy.
      const cobroTardio = cobroResponseSchema.parse(
        (
          await request(app.getHttpServer())
            .post("/collections")
            .set("Authorization", `Bearer ${collectorB.token}`)
            .send({ creditoId: creditoPeriodoId, monto: 7000 })
            .expect(201)
        ).body,
      );
      expect(cobroTardio.pago.creditoId).toBe(creditoPeriodoId);

      // El cierre YA CONGELADO no cambia — es inmutable, nunca se recalcula.
      const detalleCongelado = dailyClosureSchema.parse(
        (
          await request(app.getHttpServer())
            .get(`/daily-closures/${closureAntes.id}`)
            .set("Authorization", `Bearer ${collectorB.token}`)
            .expect(200)
        ).body,
      );
      expect(detalleCongelado.paidClients).toEqual([
        expect.objectContaining({ numeroCuota: 1, monto: 10000 }),
      ]);

      // El preview (período = desde el `createdAt` del cierre anterior, no
      // desde medianoche) SÍ ve el pago tardío — antes de este fix se
      // perdía: ni en el cierre de hoy (ya congelado) ni en el de mañana
      // (que solo mira pagos de mañana).
      const preview = closurePreviewSchema.parse(
        (
          await request(app.getHttpServer())
            .get(`/daily-closures/preview/${routeB.id}`)
            .set("Authorization", `Bearer ${collectorB.token}`)
            .expect(200)
        ).body,
      );
      expect(preview.alreadyClosed).toBe(true); // ya hay cierre para hoy...
      expect(preview.totalCollected).toBe(7000); // ...pero el pago tardío no se perdió
    });
  });

  describe("GET /daily-closures (histórico)", () => {
    it("ADMIN filtra por routeId y ve el cierre recién creado", async () => {
      const admin = await login(app, ADMIN);
      const res = await request(app.getHttpServer())
        .get(`/daily-closures?routeId=${routeA.id}`)
        .set("Authorization", `Bearer ${admin.token}`)
        .expect(200);

      const items = dailyClosureListItemSchema.array().parse(res.body);
      expect(items.length).toBeGreaterThanOrEqual(1);
      expect(items.every((c) => c.routeId === routeA.id)).toBe(true);
    });

    it("un COBRADOR ajeno no ve cierres de una ruta que no es suya", async () => {
      const collectorB = await login(app, COLLECTOR_B);
      const res = await request(app.getHttpServer())
        .get(`/daily-closures?routeId=${routeA.id}`)
        .set("Authorization", `Bearer ${collectorB.token}`)
        .expect(200);

      expect(dailyClosureListItemSchema.array().parse(res.body)).toHaveLength(0);
    });

    it("un COBRADOR ve sus propios cierres sin filtrar por routeId", async () => {
      const collectorA = await login(app, COLLECTOR_A);
      const res = await request(app.getHttpServer())
        .get("/daily-closures")
        .set("Authorization", `Bearer ${collectorA.token}`)
        .expect(200);

      const items = dailyClosureListItemSchema.array().parse(res.body);
      expect(items.some((c) => c.routeId === routeA.id)).toBe(true);
    });
  });

  describe("GET /daily-closures/:id y /:id/pdf", () => {
    let closureId: string;

    beforeAll(async () => {
      const closure = await prisma.dailyClosure.findFirstOrThrow({ where: { routeId: routeA.id } });
      closureId = closure.id;
    });

    it("ADMIN ve el detalle del snapshot, con unpaidClients", async () => {
      const admin = await login(app, ADMIN);
      const res = await request(app.getHttpServer())
        .get(`/daily-closures/${closureId}`)
        .set("Authorization", `Bearer ${admin.token}`)
        .expect(200);

      const detail = dailyClosureSchema.parse(res.body);
      expect(detail.id).toBe(closureId);
      expect(detail.unpaidClients.length).toBeGreaterThan(0);
    });

    it("un COBRADOR ajeno recibe 403", async () => {
      const collectorB = await login(app, COLLECTOR_B);
      await request(app.getHttpServer())
        .get(`/daily-closures/${closureId}`)
        .set("Authorization", `Bearer ${collectorB.token}`)
        .expect(403);
    });

    it("un id inexistente responde 404", async () => {
      const admin = await login(app, ADMIN);
      await request(app.getHttpServer())
        .get("/daily-closures/00000000-0000-0000-0000-000000000000")
        .set("Authorization", `Bearer ${admin.token}`)
        .expect(404);
    });

    it("el PDF se genera on-demand con Content-Type application/pdf", async () => {
      const admin = await login(app, ADMIN);
      const res = await request(app.getHttpServer())
        .get(`/daily-closures/${closureId}/pdf`)
        .set("Authorization", `Bearer ${admin.token}`)
        .expect(200);

      expect(res.headers["content-type"]).toContain("application/pdf");
      const bytes = Buffer.isBuffer(res.body) ? res.body : Buffer.from(res.text ?? "", "binary");
      expect(bytes.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    });

    it("un COBRADOR ajeno no puede descargar el PDF (403)", async () => {
      const collectorB = await login(app, COLLECTOR_B);
      await request(app.getHttpServer())
        .get(`/daily-closures/${closureId}/pdf`)
        .set("Authorization", `Bearer ${collectorB.token}`)
        .expect(403);
    });
  });
});

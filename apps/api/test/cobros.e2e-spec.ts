import "dotenv/config";
import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { App } from "supertest/types";
import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient } from "@prisma/client";
import {
  anularPagoResponseSchema,
  cobroResponseSchema,
  loginResponseSchema,
  rutaDetailSchema,
} from "@repo/types";
import { AppModule } from "../src/app.module";
import { seedAdminId } from "./helpers/tenant";

const ADMIN = { documento: "1000000001", password: "admin123" };
const COLLECTOR_A = { documento: "1000000002", password: "cobrador123" };
const COLLECTOR_B = { documento: "1000000003", password: "cobrador123" };
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
  let creditoChicoId: string; // dedicado a los tests de "anular pago"
  let adminIdGlobal: string;
  let productoIdGlobal: string;

  beforeAll(async () => {
    const adminId = await seedAdminId(prisma);
    adminIdGlobal = adminId;
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
    productoIdGlobal = producto.id;
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
          cuotas: 10,
          dias: 10,
          montoTotal: new Prisma.Decimal(100000),
          cuotaDiaria: new Prisma.Decimal(10000),
          saldoPendiente: new Prisma.Decimal(100000),
          estado: "ACTIVO",
        },
      });
    creditoId = (await crear(`CR-CBR-A-${Date.now()}`)).id;
    segundoCreditoId = (await crear(`CR-CBR-B-${Date.now()}`)).id;

    // Crédito chico y aislado para "anular pago": una sola cuota, para poder
    // saldarlo con un pago y probar que anularlo lo reabre.
    creditoChicoId = (
      await prisma.credito.create({
        data: {
          codigo: `CR-CBR-ANUL-${Date.now()}`,
          clienteId: cliente.id,
          productoId: producto.id,
          adminId,
          monto: new Prisma.Decimal(5000),
          interes: new Prisma.Decimal(0),
          cuotas: 1,
          dias: 1,
          montoTotal: new Prisma.Decimal(5000),
          cuotaDiaria: new Prisma.Decimal(5000),
          saldoPendiente: new Prisma.Decimal(5000),
          estado: "ACTIVO",
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

  // El ADMIN cobra en rutas que tienen cobrador asignado: es lo que habilita la
  // pantalla "Rutas de cobradores → cliente → crédito → registrar cobro" del
  // panel admin. El `Pago` queda a nombre del admin (`cobradorId = su id`), que
  // es lo correcto para la auditoría: cobró él, no el cobrador de la ruta.
  it("el ADMIN puede registrar un cobro en la ruta de un cobrador", async () => {
    const admin = await login(app, ADMIN);

    const res = await request(app.getHttpServer())
      .post("/collections")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ creditoId, monto: 1000 })
      .expect(201);

    const body = cobroResponseSchema.parse(res.body);
    const adminUser = await prisma.usuario.findUniqueOrThrow({
      where: { documento: ADMIN.documento },
    });
    expect(body.pago.cobradorId).toBe(adminUser.id);
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
    expect(receipt.headers["content-type"]).toContain("application/pdf");
    const bytes = Buffer.isBuffer(receipt.body)
      ? receipt.body
      : Buffer.from(receipt.text ?? "", "binary");
    expect(bytes.subarray(0, 5).toString("latin1")).toBe("%PDF-");
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

  describe("DELETE /collections/:pagoId (anular pago)", () => {
    // Un pago mal registrado nunca se edita: se anula (el registro queda,
    // marcado) y el saldo vuelve al crédito. Corregir = anular + cobrar de
    // nuevo con el monto correcto — el mismo POST /collections de siempre.
    it("devuelve el saldo al crédito y reabre el crédito si estaba PAGADO", async () => {
      const collector = await login(app, COLLECTOR_A);

      // Salda el crédito chico de un solo golpe (monto total = 5000).
      const cobro = await request(app.getHttpServer())
        .post("/collections")
        .set("Authorization", `Bearer ${collector.token}`)
        .send({ creditoId: creditoChicoId, monto: 5000 })
        .expect(201);
      const { pago, credito } = cobroResponseSchema.parse(cobro.body);
      expect(credito.estado).toBe("PAGADO");
      expect(credito.saldoPendiente).toBe(0);

      const anulado = await request(app.getHttpServer())
        .delete(`/collections/${pago.id}`)
        .set("Authorization", `Bearer ${collector.token}`)
        .expect(200);
      const body = anularPagoResponseSchema.parse(anulado.body);

      expect(body.pago.anulado).toBe(true);
      // Reabierto: el crédito vuelve a ACTIVO y el saldo completo regresa.
      expect(body.credito.estado).toBe("ACTIVO");
      expect(body.credito.saldoPendiente).toBe(5000);

      // Y el pago queda marcado en la base — nunca se borró.
      const enDb = await prisma.pago.findUniqueOrThrow({ where: { id: pago.id } });
      expect(enDb.anulado).toBe(true);
      expect(enDb.anuladoAt).not.toBeNull();
      expect(enDb.anuladoPorId).toBeTruthy();
    });

    it("rechaza anular el mismo pago dos veces", async () => {
      const collector = await login(app, COLLECTOR_A);

      const cobro = await request(app.getHttpServer())
        .post("/collections")
        .set("Authorization", `Bearer ${collector.token}`)
        .send({ creditoId, monto: 111 })
        .expect(201);
      const { pago } = cobroResponseSchema.parse(cobro.body);

      await request(app.getHttpServer())
        .delete(`/collections/${pago.id}`)
        .set("Authorization", `Bearer ${collector.token}`)
        .expect(200);

      // Segunda vez: ya está anulado, 409.
      await request(app.getHttpServer())
        .delete(`/collections/${pago.id}`)
        .set("Authorization", `Bearer ${collector.token}`)
        .expect(409);
    });

    it("un cobrador de otra ruta no puede anular el pago", async () => {
      const collectorA = await login(app, COLLECTOR_A);
      const cobro = await request(app.getHttpServer())
        .post("/collections")
        .set("Authorization", `Bearer ${collectorA.token}`)
        .send({ creditoId, monto: 222 })
        .expect(201);
      const { pago } = cobroResponseSchema.parse(cobro.body);

      const collectorB = await login(app, COLLECTOR_B);
      await request(app.getHttpServer())
        .delete(`/collections/${pago.id}`)
        .set("Authorization", `Bearer ${collectorB.token}`)
        .expect(403);
    });

    it("404 para un pago inexistente", async () => {
      const admin = await login(app, ADMIN);
      await request(app.getHttpServer())
        .delete("/collections/00000000-0000-0000-0000-000000000000")
        .set("Authorization", `Bearer ${admin.token}`)
        .expect(404);
    });
  });

  // Fase 6 (hardening) — DATA-1: `descontarSaldo` solo miraba `saldoPendiente`
  // en su WHERE condicional, nunca `estado`. Un cobro y una anulación
  // concurrentes sobre el mismo crédito podían "ganar" los dos: el crédito
  // quedaba ANULADO con un Pago igual aplicado encima (saldo descontado sobre
  // un crédito que debía quedar congelado). El fix agregó `estado: { in:
  // ["ACTIVO", "MORA"] }` al WHERE de `descontarSaldo` (cobros.repository.ts)
  // y volvió `anular` (creditos.service.ts) igual de condicional — Postgres
  // serializa las dos escrituras por fila (row lock): quien llegue primero
  // gana, pero el segundo reevalúa su condición contra el estado YA
  // actualizado, así que ahora es imposible que ambos tengan éxito.
  describe("POST /collections vs DELETE /credits/:id — carrera de anulación (DATA-1)", () => {
    async function crearCreditoActivo(suffix: string) {
      return prisma.credito.create({
        data: {
          codigo: `CR-CBR-RACE-${Date.now()}-${suffix}`,
          clienteId,
          productoId: productoIdGlobal,
          adminId: adminIdGlobal,
          monto: new Prisma.Decimal(1000),
          interes: new Prisma.Decimal(0),
          cuotas: 1,
          dias: 1,
          montoTotal: new Prisma.Decimal(1000),
          cuotaDiaria: new Prisma.Decimal(1000),
          saldoPendiente: new Prisma.Decimal(1000),
          estado: "ACTIVO",
        },
      });
    }

    it("de un cobro y una anulación simultáneos sobre el mismo crédito, gana exactamente uno", async () => {
      const admin = await login(app, ADMIN);

      // 5 iteraciones × 2 requests HTTP concurrentes + writes contra Supabase
      // (red, no local): supera el timeout default de Jest (5s) cuando corre
      // dentro del suite completo (16 archivos compitiendo por el pool de la
      // Supabase pooler, ver gotcha de `CLAUDE.md`), aunque en aislado es rápido.
      // Varias corridas: cuál de los dos "gana" la carrera de Postgres no es
      // determinístico (depende de qué UPDATE adquiere el row lock primero),
      // así que repetimos para no depender de una sola interleaving.
      for (let i = 0; i < 5; i++) {
        const credito = await crearCreditoActivo(String(i));

        const [cobroRes, anularRes] = await Promise.all([
          request(app.getHttpServer())
            .post("/collections")
            .set("Authorization", `Bearer ${admin.token}`)
            .send({ creditoId: credito.id, monto: 1000 }),
          request(app.getHttpServer())
            .delete(`/credits/${credito.id}`)
            .set("Authorization", `Bearer ${admin.token}`),
        ]);

        const cobroOk = cobroRes.status === 201;
        const anularOk = anularRes.status === 200;

        // Exactamente uno de los dos tuvo éxito (XOR) — nunca los dos, nunca
        // ninguno. Antes del fix, ambos podían devolver éxito.
        expect(cobroOk).not.toBe(anularOk);
        if (!cobroOk) expect(cobroRes.status).toBe(409);
        if (!anularOk) expect(anularRes.status).toBe(409);

        const final = await prisma.credito.findUniqueOrThrow({
          where: { id: credito.id },
          include: { pagos: true },
        });

        if (cobroOk) {
          // El cobro ganó: el monto exacto del saldo lo dejó PAGADO, y la
          // anulación (que corrió después, contra el estado ya actualizado)
          // no pudo tocarlo.
          expect(final.estado).toBe("PAGADO");
          expect(final.pagos).toHaveLength(1);
        } else {
          // La anulación ganó: el cobro abortó DENTRO de la transacción
          // (`descontarSaldo` afectó 0 filas), así que el rollback deja el
          // crédito sin ningún Pago — no un Pago "huérfano" sobre un crédito
          // ANULADO, que era exactamente el bug.
          expect(final.estado).toBe("ANULADO");
          expect(final.pagos).toHaveLength(0);
        }
      }
    }, 30_000);
  });
});

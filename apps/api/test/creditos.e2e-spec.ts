import "dotenv/config";
import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { App } from "supertest/types";
import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient } from "@prisma/client";
import { creditoListItemSchema, loginResponseSchema } from "@repo/types";
import { AppModule } from "../src/app.module";
import { seedAdminId } from "./helpers/tenant";

// Frecuencia de pago (diaria/semanal/mensual). Lo que se verifica acá es la
// DERIVACIÓN del crédito, que es donde estaba el riesgo: el monto de la cuota
// sale de `montoTotal / cuotas` sin importar la frecuencia, y lo único que
// cambia con ella es el plazo nominal (`dias`).

const ADMIN = { documento: "1000000001", password: "admin123" };
const COBRADOR = { documento: "1000000002", password: "cobrador123" };
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

  // Fase 6 (hardening) — sin ningún caso e2e antes de esto: `DELETE
  // /credits/:id` (anular) no tenía cobertura. DATA-1 hizo el guard
  // condicional (`estado: { in: ["ACTIVO", "MORA"] }`); estos casos prueban
  // el contrato HTTP resultante. La prueba de la CARRERA en sí (cobro vs.
  // anulación simultáneos) vive en `cobros.e2e-spec.ts`, junto al resto de
  // los tests de cobro.
  describe("DELETE /credits/:id (anular crédito)", () => {
    it("ADMIN anula un crédito ACTIVO", async () => {
      const admin = await login(app, ADMIN);
      const credito = await crear({ monto: 50_000, interes: 0, cuotas: 5 });

      const res = await request(app.getHttpServer())
        .delete(`/credits/${credito.id}`)
        .set("Authorization", `Bearer ${admin.token}`)
        .expect(200);

      const anulado = creditoListItemSchema.parse(res.body);
      expect(anulado.estado).toBe("ANULADO");
    });

    it("rechaza anular el mismo crédito dos veces (409)", async () => {
      const admin = await login(app, ADMIN);
      const credito = await crear({ monto: 20_000, interes: 0, cuotas: 2 });

      await request(app.getHttpServer())
        .delete(`/credits/${credito.id}`)
        .set("Authorization", `Bearer ${admin.token}`)
        .expect(200);

      await request(app.getHttpServer())
        .delete(`/credits/${credito.id}`)
        .set("Authorization", `Bearer ${admin.token}`)
        .expect(409);
    });

    // DATA-1: el mismo guard condicional que bloquea el doble-anulado también
    // bloquea anular un crédito que un cobro ya dejó PAGADO — antes del fix,
    // esto pisaba el estado sin chequear nada.
    it("rechaza anular un crédito ya PAGADO (409)", async () => {
      const admin = await login(app, ADMIN);
      const credito = await crear({ monto: 10_000, interes: 0, cuotas: 1 });

      await request(app.getHttpServer())
        .post("/collections")
        .set("Authorization", `Bearer ${admin.token}`)
        .send({ creditoId: credito.id, monto: 10_000 })
        .expect(201);

      await request(app.getHttpServer())
        .delete(`/credits/${credito.id}`)
        .set("Authorization", `Bearer ${admin.token}`)
        .expect(409);
    });

    it("un COBRADOR no puede anular (403)", async () => {
      const cobrador = await login(app, COBRADOR);
      const credito = await crear({ monto: 10_000, interes: 0, cuotas: 1 });

      await request(app.getHttpServer())
        .delete(`/credits/${credito.id}`)
        .set("Authorization", `Bearer ${cobrador.token}`)
        .expect(403);
    });

    it("404 para un crédito inexistente", async () => {
      const admin = await login(app, ADMIN);
      await request(app.getHttpServer())
        .delete("/credits/00000000-0000-0000-0000-000000000000")
        .set("Authorization", `Bearer ${admin.token}`)
        .expect(404);
    });
  });

  // Fase 6 (hardening) — DATA-2: `update` calculaba `saldoPendienteNuevo` con
  // `existing.pagos`, leído al PRINCIPIO del request, y lo escribía como
  // valor ABSOLUTO al final sin ninguna condición. Un cobro concurrente que
  // decrementaba el saldo relativo entre esa lectura y ese `update` quedaba
  // pisado en silencio: el `Pago` sobrevivía como fila, pero `saldoPendiente`
  // no reflejaba la plata realmente cobrada. El fix volvió la escritura
  // condicional (`updateMany` con `saldoPendiente: existing.saldoPendiente`
  // en el WHERE, mismo patrón que DATA-1) — si algo lo cambió mientras tanto,
  // aborta con 409 en vez de pisarlo.
  describe("PATCH /credits/:id vs POST /collections — carrera de edición (DATA-2)", () => {
    it("edición y cobro concurrentes nunca desincronizan saldoPendiente de lo realmente cobrado", async () => {
      const admin = await login(app, ADMIN);

      for (let i = 0; i < 5; i++) {
        const credito = await crear({ monto: 1000, interes: 0, cuotas: 1 });

        const [editRes, cobroRes] = await Promise.all([
          request(app.getHttpServer())
            .patch(`/credits/${credito.id}`)
            .set("Authorization", `Bearer ${admin.token}`)
            .send({ interes: 10 }),
          request(app.getHttpServer())
            .post("/collections")
            .set("Authorization", `Bearer ${admin.token}`)
            .send({ creditoId: credito.id, monto: 500 }),
        ]);

        // El saldo alcanza para el cobro en cualquiera de los dos órdenes
        // posibles (1000 o, si la edición ganó primero, 1100) — el cobro
        // nunca debería fallar acá. La edición puede ganar (200) o perder la
        // carrera y pedir reintento (409, el guard nuevo) — nunca otra cosa.
        expect(cobroRes.status).toBe(201);
        expect([200, 409]).toContain(editRes.status);

        const final = await prisma.credito.findUniqueOrThrow({
          where: { id: credito.id },
          include: { pagos: true },
        });
        const totalPagado = final.pagos
          .filter((p) => !p.anulado)
          .reduce((sum, p) => sum.add(p.monto), new Prisma.Decimal(0));

        // La invariante que DATA-2 rompía: saldoPendiente SIEMPRE tiene que
        // reflejar montoTotal − lo realmente cobrado, sin importar en qué
        // orden ganaron el cobro y la edición.
        expect(final.saldoPendiente.toString()).toBe(final.montoTotal.sub(totalPagado).toString());
      }
    }, 30_000);
  });
});

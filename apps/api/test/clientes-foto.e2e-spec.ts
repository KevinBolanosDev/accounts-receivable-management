import "dotenv/config";
import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { App } from "supertest/types";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";
import {
  clienteDetailSchema,
  loginResponseSchema,
  uploadFotoDocumentoResponseSchema,
} from "@repo/types";
import { AppModule } from "../src/app.module";

// Único endpoint del sistema que toca Supabase Storage de verdad — hasta
// ahora sin ningún test e2e. `describe.skip` si faltan credenciales (mismo
// patrón que cualquier suite que dependa de un servicio externo): no debe
// romper `test:e2e` en un entorno sin Storage configurado.
const hasStorage = !!process.env.SUPABASE_SERVICE_KEY && !!process.env.SUPABASE_URL;

const ADMIN = { documento: "1000000001", password: "admin123" };
const PREFIX = "foto-e2e-";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

// 1x1 PNG transparente — el archivo más pequeño posible que sigue siendo un
// PNG válido de verdad (no un buffer arbitrario con extensión falsa).
const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

async function login(
  app: INestApplication<App>,
  credentials: { documento: string; password: string },
) {
  const res = await request(app.getHttpServer()).post("/auth/login").send(credentials).expect(200);
  return loginResponseSchema.parse(res.body);
}

(hasStorage ? describe : describe.skip)("Foto de documento — Supabase Storage (e2e)", () => {
  let app: INestApplication<App>;
  // Paths subidos de verdad durante la suite: se limpian en `afterAll` porque
  // estos tests escriben objetos reales en el bucket.
  const uploadedPaths: string[] = [];

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(() => app.close());

  afterAll(async () => {
    if (uploadedPaths.length > 0) {
      const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);
      await supabase.storage.from(process.env.SUPABASE_STORAGE_BUCKET!).remove(uploadedPaths);
    }
    // ClientAdmin antes que Cliente: Restrict hacia el cliente.
    const clientes = await prisma.cliente.findMany({
      where: { documento: { startsWith: PREFIX } },
      select: { id: true },
    });
    await prisma.clientAdmin.deleteMany({ where: { clientId: { in: clientes.map((c) => c.id) } } });
    await prisma.cliente.deleteMany({ where: { documento: { startsWith: PREFIX } } });
    await prisma.$disconnect();
  });

  it("sube una imagen válida y devuelve { path, url } firmada", async () => {
    const { token } = await login(app, ADMIN);

    const res = await request(app.getHttpServer())
      .post("/clients/id-document-photo")
      .set("Authorization", `Bearer ${token}`)
      .attach("file", TINY_PNG, "documento.png")
      .expect(201);

    const body = uploadFotoDocumentoResponseSchema.parse(res.body);
    uploadedPaths.push(body.path);

    // Ya no vive dentro de un prefijo con el nombre del bucket
    // ("documentos/documentos/...", el bug de antes).
    expect(body.path.startsWith("documentos/")).toBe(false);
    expect(body.path).toMatch(/^id-documents\//);
    // Firmada: la URL de Supabase lleva el query param `token`.
    expect(body.url).toContain("token=");
  });

  it("persiste el path y el detalle del cliente devuelve la URL firmada", async () => {
    const { token } = await login(app, ADMIN);

    const uploadRes = await request(app.getHttpServer())
      .post("/clients/id-document-photo")
      .set("Authorization", `Bearer ${token}`)
      .attach("file", TINY_PNG, "documento.png")
      .expect(201);
    const { path } = uploadFotoDocumentoResponseSchema.parse(uploadRes.body);
    uploadedPaths.push(path);

    const createRes = await request(app.getHttpServer())
      .post("/clients")
      .set("Authorization", `Bearer ${token}`)
      .send({
        nombre: "Cliente Foto E2E",
        telefono: "3000000000",
        documento: `${PREFIX}${Date.now()}`,
        direccion: "Test",
        fotoDocumentoFrentePath: path,
      })
      .expect(201);
    const created = clienteDetailSchema.parse(createRes.body);

    // El POST /clients ya firma en la respuesta (toDetail firma antes de mapear).
    expect(created.fotoDocumentoFrentePath).toBe(path);
    expect(created.fotoDocumentoFrenteUrl).toContain("token=");

    // Y un GET posterior vuelve a firmar (una URL nueva, no cacheada) sin que
    // el path cambie.
    const getRes = await request(app.getHttpServer())
      .get(`/clients/${created.id}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    const fetched = clienteDetailSchema.parse(getRes.body);
    expect(fetched.fotoDocumentoFrentePath).toBe(path);
    expect(fetched.fotoDocumentoFrenteUrl).toContain("token=");
  });

  it("rechaza un archivo que no es imagen con 400 en español", async () => {
    const { token } = await login(app, ADMIN);

    const res = await request(app.getHttpServer())
      .post("/clients/id-document-photo")
      .set("Authorization", `Bearer ${token}`)
      .attach("file", Buffer.from("no soy una imagen"), {
        filename: "archivo.txt",
        contentType: "text/plain",
      })
      .expect(400);

    const body = res.body as { message?: string };
    expect(body.message).toBe("Solo se permiten imágenes JPEG, PNG o WebP.");
  });

  it("rechaza un archivo mayor a 5MB con 400 en español (no 413 en inglés)", async () => {
    const { token } = await login(app, ADMIN);
    // 5MB + 1 byte: por encima del límite del pipe (5MB) pero por debajo del
    // límite de Multer (6MB) — así el 400 en español del pipe es el que gana,
    // no el 413 "File too large" que Multer lanzaría si los límites coincidieran.
    const oversized = Buffer.alloc(5 * 1024 * 1024 + 1, 0);

    const res = await request(app.getHttpServer())
      .post("/clients/id-document-photo")
      .set("Authorization", `Bearer ${token}`)
      .attach("file", oversized, { filename: "grande.png", contentType: "image/png" })
      .expect(400);

    const body = res.body as { message?: string };
    expect(body.message).toBe("La imagen no puede superar 5 MB.");
  });

  it("responde 401 sin token", async () => {
    await request(app.getHttpServer())
      .post("/clients/id-document-photo")
      .attach("file", TINY_PNG, "documento.png")
      .expect(401);
  });
});

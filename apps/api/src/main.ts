import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // En Render (y cualquier PaaS con proxy delante) todas las requests llegan
  // desde la IP del balanceador. Sin esto, `req.ip` es esa IP única para
  // TODOS los usuarios y el ThrottlerGuard les cobra un solo bucket
  // compartido: bastaban unos pocos usuarios activos para 429 generalizado.
  // Con trust proxy, Express resuelve la IP real desde `X-Forwarded-For`.
  app.set("trust proxy", 1);

  const allowedOrigins = (process.env.WEB_ORIGIN ?? "http://localhost:3000")
    .split(",")
    .map((origin) => origin.trim().replace(/\/$/, ""))
    .filter(Boolean);
  app.enableCors({ origin: allowedOrigins });
  await app.listen(process.env.PORT ?? 3001);
}
void bootstrap();

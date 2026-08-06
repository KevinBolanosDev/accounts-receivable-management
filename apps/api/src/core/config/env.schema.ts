import { z } from "zod";

export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3001),
  WEB_ORIGIN: z.string().default("http://localhost:3000"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL es requerida"),
  JWT_SECRET: z.string().min(1, "JWT_SECRET es requerida"),
  JWT_EXPIRES_IN: z.string().default("1d"),
  SUPABASE_URL: z.string().url("SUPABASE_URL debe ser una URL válida"),
  SUPABASE_SERVICE_KEY: z.string().min(1, "SUPABASE_SERVICE_KEY es requerida"),
  SUPABASE_STORAGE_BUCKET: z.string().min(1, "SUPABASE_STORAGE_BUCKET es requerido"),
  // Fase 4 — URL pública del back (este servidor). El back la usa para
  // construir el enlace compartible del recibo (wa.me →
  // ${PUBLIC_APP_URL}/payments/:pagoId/receipt). Como el back sirve el HTML
  // del recibo directamente (ver módulo `receipts`), esta URL es la del back,
  // no la del front.
  PUBLIC_APP_URL: z.string().url().default("http://localhost:3001"),
  // Fase 5 — cierre automático de rutas por cron (`@nestjs/schedule`,
  // `core/reports/closure-policy.ts`). Apagado por default: el cierre manual
  // con `closedById` es el camino auditable; el cron es conveniencia, no debe
  // arrancar solo en un ambiente que no lo pidió explícitamente.
  //
  // NUNCA `z.coerce.boolean()` para un booleano leído de `.env`: coerciona
  // con `Boolean(valor)`, así que el STRING `"false"` (lo que hay en
  // `.env`) da `true` — cualquier variable no vacía es truthy. Encontrado en
  // producción: el cron corrió igual con `DAILY_CLOSURE_CRON_ENABLED=false`
  // en el archivo y cerró rutas solo sin que nadie lo pidiera.
  DAILY_CLOSURE_CRON_ENABLED: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  const result = envSchema.safeParse(config);

  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Variables de entorno inválidas:\n${details}`);
  }

  return result.data;
}

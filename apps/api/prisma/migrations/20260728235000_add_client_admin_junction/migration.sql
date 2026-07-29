-- Multi-tenancy v2: un Cliente puede pertenecer a más de un ADMIN a la vez.
-- `rutaId`/`activo` dejan de ser propiedad de Cliente y pasan a ClientAdmin
-- (la relación cliente↔admin) porque son propiedad de LA RELACIÓN, no de la
-- identidad: dos admins que comparten un cliente asignan rutas distintas y
-- pueden desactivar su propia relación sin afectar al otro.
-- Credito gana `adminId` explícito: ya no se puede derivar de `cliente.adminId`
-- (un cliente compartido no tiene un único admin), y sin esto un crédito que
-- el admin A le dio a un cliente compartido sería visible también para el
-- admin B con quien ese cliente también tiene relación.

-- 1. Crear ClientAdmin
CREATE TABLE "public"."ClientAdmin" (
    "id" text NOT NULL DEFAULT gen_random_uuid()::text,
    "clientId" text NOT NULL,
    "adminId" text NOT NULL,
    "rutaId" text,
    "activo" boolean NOT NULL DEFAULT true,
    "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" timestamp(3) NOT NULL,

    CONSTRAINT "ClientAdmin_pkey" PRIMARY KEY ("id")
);

-- 2. Backfill: una fila por cliente existente, copiando su relación actual
-- (todo cliente hoy tiene exactamente un admin, así que es 1:1 por ahora).
INSERT INTO "public"."ClientAdmin" ("id", "clientId", "adminId", "rutaId", "activo", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, "id", "adminId", "rutaId", "activo", now(), now()
FROM "public"."Cliente";

-- 3. Constraints e índices de ClientAdmin
ALTER TABLE "public"."ClientAdmin"
    ADD CONSTRAINT "ClientAdmin_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "public"."Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT "ClientAdmin_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "public"."Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT "ClientAdmin_rutaId_fkey" FOREIGN KEY ("rutaId") REFERENCES "public"."Ruta"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT "ClientAdmin_clientId_adminId_key" UNIQUE ("clientId", "adminId");

CREATE INDEX "ClientAdmin_adminId_idx" ON "public"."ClientAdmin"("adminId");
CREATE INDEX "ClientAdmin_rutaId_idx" ON "public"."ClientAdmin"("rutaId");

-- 4. Credito.adminId: nullable primero, backfill desde Cliente.adminId
-- (todavía existe en este punto de la migración — se borra en el paso 5),
-- luego NOT NULL + FK + índice.
ALTER TABLE "public"."Credito" ADD COLUMN "adminId" text;

UPDATE "public"."Credito" c
SET "adminId" = cl."adminId"
FROM "public"."Cliente" cl
WHERE cl."id" = c."clienteId";

ALTER TABLE "public"."Credito" ALTER COLUMN "adminId" SET NOT NULL;

ALTER TABLE "public"."Credito"
    ADD CONSTRAINT "Credito_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "public"."Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "Credito_adminId_idx" ON "public"."Credito"("adminId");

-- 5. Cliente pierde rutaId/adminId/activo (ahora viven en ClientAdmin).
-- DROP COLUMN se lleva en cascada su FK e índice propios
-- (Cliente_rutaId_fkey, Cliente_rutaId_idx, Cliente_adminId_fkey, Cliente_adminId_idx).
ALTER TABLE "public"."Cliente" DROP COLUMN "rutaId";
ALTER TABLE "public"."Cliente" DROP COLUMN "adminId";
ALTER TABLE "public"."Cliente" DROP COLUMN "activo";

-- Multi-tenancy: el ADMIN pasa a ser la raíz del tenant.
--
-- Antes, `ADMIN` significaba "ve todo": ningún servicio filtraba por dueño, así
-- que dos admins distintos compartían rutas, clientes, cobradores y créditos.
-- Esta migración introduce propiedad explícita:
--   · Usuario.adminId  → el ADMIN dueño de un COBRADOR (null si el usuario ES el ADMIN)
--   · Ruta/Cliente/Producto.adminId → dueño explícito, NOT NULL
--
-- `Credito` y `Pago` NO llevan columna propia: su tenant se deriva por
-- `credito.cliente.adminId`, que siempre existe (a diferencia de la cadena
-- ruta→cobrador, que se rompe con clientes sin ruta o rutas sin cobrador).
--
-- Los datos preexistentes se asignan a "Admin Demo" (documento 1000000001).

-- 1. Columnas nuevas. Todas nullable de entrada para poder backfillear; las de
--    Ruta/Cliente/Producto pasan a NOT NULL en el paso 4.
ALTER TABLE "Usuario" ADD COLUMN "adminId" TEXT;
ALTER TABLE "Ruta" ADD COLUMN "adminId" TEXT;
ALTER TABLE "Cliente" ADD COLUMN "adminId" TEXT;
ALTER TABLE "Producto" ADD COLUMN "adminId" TEXT;

-- 2. Backfill al admin destino. En una base vacía (CI / test e2e) no hay ningún
--    ADMIN todavía y los UPDATE no afectan filas — es el caso esperado.
DO $$
DECLARE
  default_admin_id TEXT;
BEGIN
  SELECT id INTO default_admin_id
  FROM "Usuario"
  WHERE documento = '1000000001' AND rol = 'ADMIN'
  LIMIT 1;

  -- Fallback: cualquier ADMIN (el más antiguo) si no existe el demo.
  IF default_admin_id IS NULL THEN
    SELECT id INTO default_admin_id
    FROM "Usuario"
    WHERE rol = 'ADMIN'
    ORDER BY "createdAt" ASC
    LIMIT 1;
  END IF;

  IF default_admin_id IS NOT NULL THEN
    UPDATE "Usuario" SET "adminId" = default_admin_id WHERE rol = 'COBRADOR' AND "adminId" IS NULL;
    UPDATE "Ruta"     SET "adminId" = default_admin_id WHERE "adminId" IS NULL;
    UPDATE "Cliente"  SET "adminId" = default_admin_id WHERE "adminId" IS NULL;
    UPDATE "Producto" SET "adminId" = default_admin_id WHERE "adminId" IS NULL;
  END IF;
END $$;

-- 3. Guardia: si hay datos pero ningún ADMIN al que asignárselos, abortar con un
--    mensaje claro en vez de reventar en el SET NOT NULL con un error opaco.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "Ruta" WHERE "adminId" IS NULL)
     OR EXISTS (SELECT 1 FROM "Cliente" WHERE "adminId" IS NULL)
     OR EXISTS (SELECT 1 FROM "Producto" WHERE "adminId" IS NULL) THEN
    RAISE EXCEPTION 'Backfill multi-tenant: hay filas sin adminId y no existe ningún usuario ADMIN. Crea un ADMIN antes de aplicar esta migración.';
  END IF;
END $$;

-- 4. Ahora sí, obligatorias.
ALTER TABLE "Ruta"     ALTER COLUMN "adminId" SET NOT NULL;
ALTER TABLE "Cliente"  ALTER COLUMN "adminId" SET NOT NULL;
ALTER TABLE "Producto" ALTER COLUMN "adminId" SET NOT NULL;

-- 5. Unicidad global → por tenant. `Ruta.nombre` y `Producto.nombre` son nombres
--    de display: con un unique global, el primer admin que registrara "Ruta
--    Centro" o "Nevera" se lo bloqueaba a todos los demás.
--    `Usuario.documento` y `Cliente.documento` SIGUEN siendo únicos globales a
--    propósito: el login (staff y portal del cliente) resuelve por documento y
--    un unique por tenant lo volvería ambiguo.
DROP INDEX IF EXISTS "Ruta_nombre_key";
DROP INDEX IF EXISTS "Producto_nombre_key";
CREATE UNIQUE INDEX "Ruta_adminId_nombre_key" ON "Ruta"("adminId", "nombre");
CREATE UNIQUE INDEX "Producto_adminId_nombre_key" ON "Producto"("adminId", "nombre");

-- 6. Índices de scoping (todas las queries filtran por adminId).
CREATE INDEX "Usuario_adminId_idx"  ON "Usuario"("adminId");
CREATE INDEX "Ruta_adminId_idx"     ON "Ruta"("adminId");
CREATE INDEX "Cliente_adminId_idx"  ON "Cliente"("adminId");
CREATE INDEX "Producto_adminId_idx" ON "Producto"("adminId");

-- 7. FKs. RESTRICT en todas: un ADMIN con cartera viva no se puede borrar.
ALTER TABLE "Usuario"  ADD CONSTRAINT "Usuario_adminId_fkey"  FOREIGN KEY ("adminId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Ruta"     ADD CONSTRAINT "Ruta_adminId_fkey"     FOREIGN KEY ("adminId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Cliente"  ADD CONSTRAINT "Cliente_adminId_fkey"  FOREIGN KEY ("adminId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Producto" ADD CONSTRAINT "Producto_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

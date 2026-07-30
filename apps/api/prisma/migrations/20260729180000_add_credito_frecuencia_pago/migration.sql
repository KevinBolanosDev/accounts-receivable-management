-- Cuotas semanales y mensuales. El cálculo del dinero no cambia
-- (`cuotaDiaria = montoTotal / cuotas`); lo que cambia es el paso del
-- calendario con el que se proyectan los vencimientos.
--
-- Aditiva a propósito: `dias` NO se dropea. Cuando todo el cobro era diario,
-- `dias` ERA el número de cuotas, así que el backfill de `cuotas` es una copia
-- directa y los créditos existentes quedan como créditos DIARIO idénticos a
-- como estaban. `dias` pasa a ser el plazo nominal (cuotas * 1|7|30).
CREATE TYPE "public"."FrecuenciaPago" AS ENUM ('DIARIO', 'SEMANAL', 'MENSUAL');

ALTER TABLE "public"."Credito"
  ADD COLUMN "frecuencia" "public"."FrecuenciaPago" NOT NULL DEFAULT 'DIARIO';

-- Se agrega con DEFAULT 0 para poder ser NOT NULL sobre las filas que ya
-- existen, se backfillea desde `dias`, y recién ahí se quita el default: un
-- crédito nuevo SIEMPRE debe declarar sus cuotas, y con el default puesto un
-- INSERT que se las olvide crearía un crédito de 0 cuotas en silencio.
ALTER TABLE "public"."Credito" ADD COLUMN "cuotas" INTEGER NOT NULL DEFAULT 0;
UPDATE "public"."Credito" SET "cuotas" = "dias";
ALTER TABLE "public"."Credito" ALTER COLUMN "cuotas" DROP DEFAULT;

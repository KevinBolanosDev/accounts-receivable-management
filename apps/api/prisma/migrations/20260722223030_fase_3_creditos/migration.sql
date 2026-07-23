-- Fase 3 — Productos + Créditos + Pagos.
-- Dinero siempre en Decimal(12,2), nunca Float. onDelete: Restrict en todas las
-- FKs de dinero (registros auditables). `saldoPendiente` materializado (se
-- recalcula en la transacción del cobro, §3.9). MORA se deriva en lectura en
-- la Fase 3 (cierre diario la persiste, §Fase 5).

-- Enums
CREATE TYPE "EstadoCredito" AS ENUM ('ACTIVO', 'PAGADO', 'MORA', 'ANULADO');

CREATE TABLE "Producto" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "precioBase" DECIMAL(12,2) NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Producto_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Producto_nombre_key" ON "Producto"("nombre");

-- Secuencia para generar `Credito.codigo` (CR-XXXX). Race-safe: `nextval` es
-- atómico. Empieza en 2000 (los CR-2041 etc. del seed ya tienen ese rango).
CREATE SEQUENCE IF NOT EXISTS "credito_codigo_seq" START 2000;

CREATE TABLE "Credito" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "montoTotal" DECIMAL(12,2) NOT NULL,
    "cuotaDiaria" DECIMAL(12,2) NOT NULL,
    "saldoPendiente" DECIMAL(12,2) NOT NULL,
    "estado" "EstadoCredito" NOT NULL DEFAULT 'ACTIVO',
    "fechaInicio" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Credito_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Credito_codigo_key" ON "Credito"("codigo");
CREATE INDEX "Credito_clienteId_idx" ON "Credito"("clienteId");
CREATE INDEX "Credito_estado_idx" ON "Credito"("estado");

CREATE TABLE "Pago" (
    "id" TEXT NOT NULL,
    "creditoId" TEXT NOT NULL,
    "monto" DECIMAL(12,2) NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cobradorId" TEXT NOT NULL,
    "reciboUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Pago_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Pago_creditoId_idx" ON "Pago"("creditoId");
CREATE INDEX "Pago_cobradorId_idx" ON "Pago"("cobradorId");

-- FKs (Restrict en todos para no perder dinero)
ALTER TABLE "Credito" ADD CONSTRAINT "Credito_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Credito" ADD CONSTRAINT "Credito_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Pago" ADD CONSTRAINT "Pago_creditoId_fkey" FOREIGN KEY ("creditoId") REFERENCES "Credito"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Pago" ADD CONSTRAINT "Pago_cobradorId_fkey" FOREIGN KEY ("cobradorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

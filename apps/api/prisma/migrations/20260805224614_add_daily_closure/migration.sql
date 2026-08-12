-- CreateEnum
CREATE TYPE "ClosureStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateTable
CREATE TABLE "DailyClosure" (
    "id" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "totalCollected" DECIMAL(12,2) NOT NULL,
    "collectedCount" INTEGER NOT NULL DEFAULT 0,
    "newCredits" INTEGER NOT NULL DEFAULT 0,
    "newCreditsAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "productsSold" INTEGER NOT NULL DEFAULT 0,
    "unpaidClients" JSONB NOT NULL,
    "unpaidCount" INTEGER NOT NULL DEFAULT 0,
    "pdfUrl" TEXT,
    "status" "ClosureStatus" NOT NULL DEFAULT 'CLOSED',
    "closedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyClosure_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DailyClosure_routeId_idx" ON "DailyClosure"("routeId");

-- CreateIndex
CREATE INDEX "DailyClosure_date_idx" ON "DailyClosure"("date");

-- CreateIndex
CREATE UNIQUE INDEX "DailyClosure_routeId_date_key" ON "DailyClosure"("routeId", "date");

-- AddForeignKey
ALTER TABLE "DailyClosure" ADD CONSTRAINT "DailyClosure_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "Ruta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyClosure" ADD CONSTRAINT "DailyClosure_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

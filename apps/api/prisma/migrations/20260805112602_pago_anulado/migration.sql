-- AlterTable
ALTER TABLE "ClientAdmin" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Pago" ADD COLUMN     "anulado" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "anuladoAt" TIMESTAMP(3),
ADD COLUMN     "anuladoPorId" TEXT;

-- AddForeignKey
ALTER TABLE "Pago" ADD CONSTRAINT "Pago_anuladoPorId_fkey" FOREIGN KEY ("anuladoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

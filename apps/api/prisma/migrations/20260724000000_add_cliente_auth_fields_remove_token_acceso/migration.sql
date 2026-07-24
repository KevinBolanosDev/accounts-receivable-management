-- Fase 4 — agregar campos de auth del cliente al portal (credenciales) y
-- eliminar `tokenAcceso` (ya no se usa — el cliente entra con documento +
-- password, no por enlace con token). Migración con defaults razonables para
-- los clientes existentes: `passwordHash` queda null (sin acceso) y los
-- contadores de seguridad arrancan en cero.

-- DropIndex
DROP INDEX IF EXISTS "Cliente_tokenAcceso_key";

-- AlterTable
ALTER TABLE "Cliente" DROP COLUMN "tokenAcceso",
ADD COLUMN     "passwordHash" TEXT,
ADD COLUMN     "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "passwordExpiresAt" TIMESTAMP(3),
ADD COLUMN     "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lockedUntil" TIMESTAMP(3),
ADD COLUMN     "lastLoginAt" TIMESTAMP(3);
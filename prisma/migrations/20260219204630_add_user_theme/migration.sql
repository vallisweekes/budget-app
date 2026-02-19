-- DropIndex
DROP INDEX "Debt_defaultPaymentCardDebtId_idx";

-- DropIndex
DROP INDEX "Debt_lastAccrualMonth_idx";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "theme" TEXT NOT NULL DEFAULT 'storm-cyan';

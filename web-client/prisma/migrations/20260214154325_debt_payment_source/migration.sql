-- CreateEnum
CREATE TYPE "DebtPaymentSource" AS ENUM ('income', 'extra_funds');

-- AlterTable
ALTER TABLE "DebtPayment"
ADD COLUMN "year" INTEGER,
ADD COLUMN "month" INTEGER,
ADD COLUMN "source" "DebtPaymentSource" NOT NULL DEFAULT 'income';

-- Backfill year/month for existing rows (UTC based on stored timestamp)
UPDATE "DebtPayment"
SET
  "year" = EXTRACT(YEAR FROM "paidAt")::INTEGER,
  "month" = EXTRACT(MONTH FROM "paidAt")::INTEGER
WHERE "year" IS NULL OR "month" IS NULL;

-- Enforce required columns after backfill
ALTER TABLE "DebtPayment"
ALTER COLUMN "year" SET NOT NULL,
ALTER COLUMN "month" SET NOT NULL;

-- CreateIndex
CREATE INDEX "DebtPayment_debtId_year_month_idx" ON "DebtPayment"("debtId", "year", "month");

-- CreateIndex
CREATE INDEX "DebtPayment_year_month_source_idx" ON "DebtPayment"("year", "month", "source");

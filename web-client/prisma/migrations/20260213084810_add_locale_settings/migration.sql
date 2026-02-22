-- AlterTable
ALTER TABLE "BudgetPlan" ADD COLUMN     "country" TEXT NOT NULL DEFAULT 'GB',
ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'GBP',
ADD COLUMN     "language" TEXT NOT NULL DEFAULT 'en';

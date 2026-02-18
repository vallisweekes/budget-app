-- AlterTable
ALTER TABLE "BudgetPlan" ADD COLUMN     "emergencyBalance" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "eventDate" TIMESTAMP(3),
ADD COLUMN     "includePostEventIncome" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "BudgetPlan"
ADD COLUMN "incomeDistributeFullYearDefault" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "incomeDistributeHorizonDefault" BOOLEAN NOT NULL DEFAULT false;

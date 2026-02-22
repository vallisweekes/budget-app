-- AlterTable
ALTER TABLE "BudgetPlan" ADD COLUMN     "monthlyEmergencyContribution" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "MonthlyAllocation" ADD COLUMN     "monthlyEmergencyContribution" DECIMAL(12,2) NOT NULL DEFAULT 0;

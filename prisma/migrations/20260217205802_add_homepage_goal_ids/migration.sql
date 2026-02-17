-- AlterTable
ALTER TABLE "BudgetPlan" ADD COLUMN     "homepageGoalIds" TEXT[] DEFAULT ARRAY[]::TEXT[];

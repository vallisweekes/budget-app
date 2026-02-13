-- CreateEnum
CREATE TYPE "BudgetPlanKind" AS ENUM ('personal', 'holiday', 'carnival');

-- AlterTable
ALTER TABLE "BudgetPlan" ADD COLUMN     "kind" "BudgetPlanKind" NOT NULL DEFAULT 'personal';

-- CreateIndex
CREATE INDEX "BudgetPlan_userId_kind_idx" ON "BudgetPlan"("userId", "kind");

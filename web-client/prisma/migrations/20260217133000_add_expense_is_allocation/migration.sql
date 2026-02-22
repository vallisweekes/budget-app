-- AlterTable
ALTER TABLE "Expense" ADD COLUMN     "isAllocation" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Expense_budgetPlanId_isAllocation_idx" ON "Expense"("budgetPlanId", "isAllocation");

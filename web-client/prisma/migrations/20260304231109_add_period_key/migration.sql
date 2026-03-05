-- AlterTable
ALTER TABLE "DebtPayment" ADD COLUMN     "periodKey" TEXT;

-- AlterTable
ALTER TABLE "Expense" ADD COLUMN     "periodKey" TEXT;

-- AlterTable
ALTER TABLE "ExpensePayment" ADD COLUMN     "periodKey" TEXT;

-- AlterTable
ALTER TABLE "Income" ADD COLUMN     "periodKey" TEXT;

-- CreateIndex
CREATE INDEX "DebtPayment_periodKey_idx" ON "DebtPayment"("periodKey");

-- CreateIndex
CREATE INDEX "Expense_budgetPlanId_periodKey_idx" ON "Expense"("budgetPlanId", "periodKey");

-- CreateIndex
CREATE INDEX "ExpensePayment_periodKey_idx" ON "ExpensePayment"("periodKey");

-- CreateIndex
CREATE INDEX "Income_budgetPlanId_periodKey_idx" ON "Income"("budgetPlanId", "periodKey");

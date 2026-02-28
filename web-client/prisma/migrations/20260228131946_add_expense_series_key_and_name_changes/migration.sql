-- AlterTable
ALTER TABLE "Expense" ADD COLUMN     "seriesKey" TEXT;

-- CreateTable
CREATE TABLE "ExpenseNameChange" (
    "id" TEXT NOT NULL,
    "expenseId" TEXT NOT NULL,
    "fromName" TEXT NOT NULL,
    "toName" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExpenseNameChange_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExpenseNameChange_expenseId_idx" ON "ExpenseNameChange"("expenseId");

-- CreateIndex
CREATE INDEX "ExpenseNameChange_changedAt_idx" ON "ExpenseNameChange"("changedAt");

-- CreateIndex
CREATE INDEX "Expense_budgetPlanId_seriesKey_idx" ON "Expense"("budgetPlanId", "seriesKey");

-- AddForeignKey
ALTER TABLE "ExpenseNameChange" ADD CONSTRAINT "ExpenseNameChange_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense"("id") ON DELETE CASCADE ON UPDATE CASCADE;

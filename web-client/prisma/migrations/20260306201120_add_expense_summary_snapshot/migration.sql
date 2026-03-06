-- CreateTable
CREATE TABLE "ExpenseSummarySnapshot" (
    "id" TEXT NOT NULL,
    "budgetPlanId" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "payDate" INTEGER NOT NULL,
    "payFrequency" TEXT NOT NULL,
    "periodKey" TEXT,
    "periodLabel" TEXT,
    "periodIndex" INTEGER,
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "periodRangeLabel" TEXT,
    "totalCount" INTEGER NOT NULL,
    "totalAmount" DECIMAL(12,2) NOT NULL,
    "paidCount" INTEGER NOT NULL,
    "paidAmount" DECIMAL(12,2) NOT NULL,
    "unpaidCount" INTEGER NOT NULL,
    "unpaidAmount" DECIMAL(12,2) NOT NULL,
    "categoryBreakdown" JSONB NOT NULL,
    "sourceMaxUpdatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExpenseSummarySnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExpenseSummarySnapshot_budgetPlanId_scope_periodKey_idx" ON "ExpenseSummarySnapshot"("budgetPlanId", "scope", "periodKey");

-- CreateIndex
CREATE UNIQUE INDEX "ExpenseSummarySnapshot_budgetPlanId_scope_month_year_key" ON "ExpenseSummarySnapshot"("budgetPlanId", "scope", "month", "year");

-- AddForeignKey
ALTER TABLE "ExpenseSummarySnapshot" ADD CONSTRAINT "ExpenseSummarySnapshot_budgetPlanId_fkey" FOREIGN KEY ("budgetPlanId") REFERENCES "BudgetPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

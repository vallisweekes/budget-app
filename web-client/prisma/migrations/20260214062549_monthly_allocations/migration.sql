-- CreateTable
CREATE TABLE "MonthlyAllocation" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "monthlyAllowance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "monthlySavingsContribution" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "monthlyInvestmentContribution" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "budgetPlanId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MonthlyAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MonthlyAllocation_budgetPlanId_idx" ON "MonthlyAllocation"("budgetPlanId");

-- CreateIndex
CREATE UNIQUE INDEX "MonthlyAllocation_budgetPlanId_year_month_key" ON "MonthlyAllocation"("budgetPlanId", "year", "month");

-- AddForeignKey
ALTER TABLE "MonthlyAllocation" ADD CONSTRAINT "MonthlyAllocation_budgetPlanId_fkey" FOREIGN KEY ("budgetPlanId") REFERENCES "BudgetPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

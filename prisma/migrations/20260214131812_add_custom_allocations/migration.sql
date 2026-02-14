-- CreateTable
CREATE TABLE "AllocationDefinition" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "defaultAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "budgetPlanId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AllocationDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MonthlyAllocationItem" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "allocationId" TEXT NOT NULL,
    "budgetPlanId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MonthlyAllocationItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AllocationDefinition_budgetPlanId_isArchived_sortOrder_idx" ON "AllocationDefinition"("budgetPlanId", "isArchived", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "AllocationDefinition_budgetPlanId_name_key" ON "AllocationDefinition"("budgetPlanId", "name");

-- CreateIndex
CREATE INDEX "MonthlyAllocationItem_budgetPlanId_year_month_idx" ON "MonthlyAllocationItem"("budgetPlanId", "year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "MonthlyAllocationItem_allocationId_year_month_key" ON "MonthlyAllocationItem"("allocationId", "year", "month");

-- AddForeignKey
ALTER TABLE "AllocationDefinition" ADD CONSTRAINT "AllocationDefinition_budgetPlanId_fkey" FOREIGN KEY ("budgetPlanId") REFERENCES "BudgetPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonthlyAllocationItem" ADD CONSTRAINT "MonthlyAllocationItem_allocationId_fkey" FOREIGN KEY ("allocationId") REFERENCES "AllocationDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonthlyAllocationItem" ADD CONSTRAINT "MonthlyAllocationItem_budgetPlanId_fkey" FOREIGN KEY ("budgetPlanId") REFERENCES "BudgetPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

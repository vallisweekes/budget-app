-- CreateTable
CREATE TABLE "SacrificeGoalLink" (
    "id" TEXT NOT NULL,
    "targetKey" TEXT NOT NULL,
    "budgetPlanId" TEXT NOT NULL,
    "goalId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SacrificeGoalLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SacrificeTransferConfirmation" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "targetKey" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "confirmedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "budgetPlanId" TEXT NOT NULL,
    "goalId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SacrificeTransferConfirmation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SacrificeGoalLink_budgetPlanId_targetKey_key" ON "SacrificeGoalLink"("budgetPlanId", "targetKey");

-- CreateIndex
CREATE INDEX "SacrificeGoalLink_goalId_idx" ON "SacrificeGoalLink"("goalId");

-- CreateIndex
CREATE INDEX "SacrificeGoalLink_budgetPlanId_idx" ON "SacrificeGoalLink"("budgetPlanId");

-- CreateIndex
CREATE UNIQUE INDEX "SacrificeTransferConfirmation_budgetPlanId_year_month_targetKey_key" ON "SacrificeTransferConfirmation"("budgetPlanId", "year", "month", "targetKey");

-- CreateIndex
CREATE INDEX "SacrificeTransferConfirmation_goalId_idx" ON "SacrificeTransferConfirmation"("goalId");

-- CreateIndex
CREATE INDEX "SacrificeTransferConfirmation_budgetPlanId_year_month_idx" ON "SacrificeTransferConfirmation"("budgetPlanId", "year", "month");

-- AddForeignKey
ALTER TABLE "SacrificeGoalLink" ADD CONSTRAINT "SacrificeGoalLink_budgetPlanId_fkey" FOREIGN KEY ("budgetPlanId") REFERENCES "BudgetPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SacrificeGoalLink" ADD CONSTRAINT "SacrificeGoalLink_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "Goal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SacrificeTransferConfirmation" ADD CONSTRAINT "SacrificeTransferConfirmation_budgetPlanId_fkey" FOREIGN KEY ("budgetPlanId") REFERENCES "BudgetPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SacrificeTransferConfirmation" ADD CONSTRAINT "SacrificeTransferConfirmation_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "Goal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateEnum
CREATE TYPE "SavingsPotField" AS ENUM ('savings', 'emergency', 'investment');

-- CreateTable
CREATE TABLE "SavingsPot" (
    "id" TEXT NOT NULL,
    "field" "SavingsPotField" NOT NULL,
    "name" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "broker" TEXT NOT NULL DEFAULT 'none',
    "allocationId" TEXT,
    "budgetPlanId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavingsPot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SavingsPot_budgetPlanId_field_createdAt_idx" ON "SavingsPot"("budgetPlanId", "field", "createdAt");

-- AddForeignKey
ALTER TABLE "SavingsPot" ADD CONSTRAINT "SavingsPot_budgetPlanId_fkey" FOREIGN KEY ("budgetPlanId") REFERENCES "BudgetPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

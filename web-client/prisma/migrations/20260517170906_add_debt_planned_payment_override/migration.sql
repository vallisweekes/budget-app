-- CreateTable
CREATE TABLE "DebtPlannedPaymentOverride" (
    "id" TEXT NOT NULL,
    "debtId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "periodKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DebtPlannedPaymentOverride_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DebtPlannedPaymentOverride_periodKey_idx" ON "DebtPlannedPaymentOverride"("periodKey");

-- CreateIndex
CREATE INDEX "DebtPlannedPaymentOverride_year_month_idx" ON "DebtPlannedPaymentOverride"("year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "DebtPlannedPaymentOverride_debtId_periodKey_key" ON "DebtPlannedPaymentOverride"("debtId", "periodKey");

-- AddForeignKey
ALTER TABLE "DebtPlannedPaymentOverride" ADD CONSTRAINT "DebtPlannedPaymentOverride_debtId_fkey" FOREIGN KEY ("debtId") REFERENCES "Debt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

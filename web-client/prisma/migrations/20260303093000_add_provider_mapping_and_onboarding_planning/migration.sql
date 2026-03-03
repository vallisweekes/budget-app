-- AlterTable
ALTER TABLE "UserOnboardingProfile"
ADD COLUMN "planningYears" INTEGER,
ADD COLUMN "savingsGoalAmount" DECIMAL(12, 2),
ADD COLUMN "savingsGoalYear" INTEGER;

-- CreateTable
CREATE TABLE "ExpenseProviderMapping" (
  "id" TEXT NOT NULL,
  "countryCode" TEXT NOT NULL DEFAULT 'GB',
  "providerName" TEXT NOT NULL,
  "aliases" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "categoryName" TEXT NOT NULL DEFAULT 'Utilities',
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ExpenseProviderMapping_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ExpenseProviderMapping_countryCode_providerName_key"
ON "ExpenseProviderMapping"("countryCode", "providerName");

-- CreateIndex
CREATE INDEX "ExpenseProviderMapping_countryCode_isActive_idx"
ON "ExpenseProviderMapping"("countryCode", "isActive");

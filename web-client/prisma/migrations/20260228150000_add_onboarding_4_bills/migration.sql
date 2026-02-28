-- Add extra onboarding bill fields (3 & 4)

ALTER TABLE "UserOnboardingProfile"
ADD COLUMN "expenseThreeName" TEXT,
ADD COLUMN "expenseThreeAmount" DECIMAL(12, 2),
ADD COLUMN "expenseFourName" TEXT,
ADD COLUMN "expenseFourAmount" DECIMAL(12, 2);

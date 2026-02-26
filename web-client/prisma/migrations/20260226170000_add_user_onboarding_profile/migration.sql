-- Create enums
CREATE TYPE "OnboardingGoal" AS ENUM ('improve_savings', 'manage_debts', 'track_spending');
CREATE TYPE "OnboardingStatus" AS ENUM ('started', 'completed');

-- Create table
CREATE TABLE "UserOnboardingProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "OnboardingStatus" NOT NULL DEFAULT 'started',
    "completedAt" TIMESTAMP(3),
    "mainGoal" "OnboardingGoal",
    "occupation" TEXT,
    "occupationOther" TEXT,
    "monthlySalary" DECIMAL(12,2),
    "expenseOneName" TEXT,
    "expenseOneAmount" DECIMAL(12,2),
    "expenseTwoName" TEXT,
    "expenseTwoAmount" DECIMAL(12,2),
    "hasAllowance" BOOLEAN,
    "allowanceAmount" DECIMAL(12,2),
    "hasDebtsToManage" BOOLEAN,
    "debtAmount" DECIMAL(12,2),
    "debtNotes" TEXT,
    "generatedPlanId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "UserOnboardingProfile_pkey" PRIMARY KEY ("id")
);

-- Indexes and constraints
CREATE UNIQUE INDEX "UserOnboardingProfile_userId_key" ON "UserOnboardingProfile"("userId");
CREATE INDEX "UserOnboardingProfile_status_idx" ON "UserOnboardingProfile"("status");

-- Foreign key
ALTER TABLE "UserOnboardingProfile"
ADD CONSTRAINT "UserOnboardingProfile_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

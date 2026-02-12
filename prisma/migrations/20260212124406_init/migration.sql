-- CreateEnum
CREATE TYPE "DebtType" AS ENUM ('credit_card', 'loan', 'high_purchase', 'other');

-- CreateEnum
CREATE TYPE "GoalType" AS ENUM ('yearly', 'long_term', 'short_term');

-- CreateEnum
CREATE TYPE "GoalCategory" AS ENUM ('debt', 'emergency', 'savings', 'investment', 'other');

-- CreateEnum
CREATE TYPE "BudgetStrategy" AS ENUM ('payYourselfFirst', 'zeroBased', 'fiftyThirtyTwenty');

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT,
    "color" TEXT,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Expense" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "paid" BOOLEAN NOT NULL DEFAULT false,
    "paidAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "categoryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Income" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Income_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Debt" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "DebtType" NOT NULL,
    "initialBalance" DECIMAL(12,2) NOT NULL,
    "currentBalance" DECIMAL(12,2) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "paid" BOOLEAN NOT NULL DEFAULT false,
    "paidAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "monthlyMinimum" DECIMAL(12,2),
    "sourceType" TEXT,
    "sourceExpenseId" TEXT,
    "sourceMonthKey" TEXT,
    "sourceCategoryId" TEXT,
    "sourceCategoryName" TEXT,
    "sourceExpenseName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Debt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DebtPayment" (
    "id" TEXT NOT NULL,
    "debtId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DebtPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Goal" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" "GoalType" NOT NULL,
    "category" "GoalCategory" NOT NULL,
    "description" TEXT,
    "targetAmount" DECIMAL(12,2),
    "currentAmount" DECIMAL(12,2) DEFAULT 0,
    "targetYear" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Goal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Settings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "payDate" INTEGER NOT NULL DEFAULT 27,
    "monthlyAllowance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "savingsBalance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "monthlySavingsContribution" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "monthlyInvestmentContribution" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "budgetStrategy" "BudgetStrategy" NOT NULL DEFAULT 'payYourselfFirst',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Category_name_key" ON "Category"("name");

-- CreateIndex
CREATE INDEX "Expense_month_year_idx" ON "Expense"("month", "year");

-- CreateIndex
CREATE INDEX "Expense_categoryId_idx" ON "Expense"("categoryId");

-- CreateIndex
CREATE INDEX "Income_month_year_idx" ON "Income"("month", "year");

-- CreateIndex
CREATE INDEX "DebtPayment_debtId_idx" ON "DebtPayment"("debtId");

-- CreateIndex
CREATE INDEX "DebtPayment_paidAt_idx" ON "DebtPayment"("paidAt");

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DebtPayment" ADD CONSTRAINT "DebtPayment_debtId_fkey" FOREIGN KEY ("debtId") REFERENCES "Debt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

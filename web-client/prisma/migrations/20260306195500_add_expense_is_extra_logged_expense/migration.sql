-- AlterTable
ALTER TABLE "Expense"
ADD COLUMN "isExtraLoggedExpense" BOOLEAN NOT NULL DEFAULT false;

-- Backfill currently logged-like rows so existing behavior is preserved
UPDATE "Expense"
SET "isExtraLoggedExpense" = true
WHERE "dueDate" IS NULL
  AND COALESCE("isAllocation", false) = false
  AND COALESCE("isDirectDebit", false) = false;

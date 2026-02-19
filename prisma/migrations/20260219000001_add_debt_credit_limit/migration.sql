-- Add optional credit limit for credit card debts
-- Safe to re-run.
ALTER TABLE "Debt"
  ADD COLUMN IF NOT EXISTS "creditLimit" DECIMAL(12, 2);

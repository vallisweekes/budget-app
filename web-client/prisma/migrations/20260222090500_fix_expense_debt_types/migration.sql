-- Expense carryover debts should not be categorized as hire_purchase.
-- Ensure existing expense debts use type 'other'.
-- Idempotent: safe to re-run.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'Debt' AND column_name = 'sourceType'
  ) THEN
    UPDATE "Debt"
    SET "type" = 'other'
    WHERE "sourceType" = 'expense'
      AND "type" = 'hire_purchase';
  END IF;
END $$;

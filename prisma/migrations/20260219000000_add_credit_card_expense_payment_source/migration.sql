-- Add a new enum value for ExpensePaymentSource
-- This is written to be safe to re-run.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'ExpensePaymentSource'
      AND e.enumlabel = 'credit_card'
  ) THEN
    ALTER TYPE "ExpensePaymentSource" ADD VALUE 'credit_card';
  END IF;
END$$;

-- Rename DebtType enum value: high_purchase -> hire_purchase (Postgres enum)
-- Idempotent: safe to re-run.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'DebtType' AND e.enumlabel = 'high_purchase'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'DebtType' AND e.enumlabel = 'hire_purchase'
  ) THEN
    ALTER TYPE "DebtType" RENAME VALUE 'high_purchase' TO 'hire_purchase';
  END IF;
END $$;

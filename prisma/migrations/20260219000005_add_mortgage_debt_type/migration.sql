-- Add mortgage as a DebtType (Postgres enum)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'DebtType' AND e.enumlabel = 'mortgage'
  ) THEN
    ALTER TYPE "DebtType" ADD VALUE 'mortgage';
  END IF;
END $$;

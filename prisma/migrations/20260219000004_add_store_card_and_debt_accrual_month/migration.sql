-- Add store_card as a DebtType (Postgres enum)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'DebtType' AND e.enumlabel = 'store_card'
  ) THEN
    ALTER TYPE "DebtType" ADD VALUE 'store_card';
  END IF;
END $$;

-- Track per-debt accrual processing month (YYYY-MM)
ALTER TABLE "Debt"
ADD COLUMN IF NOT EXISTS "lastAccrualMonth" TEXT;

CREATE INDEX IF NOT EXISTS "Debt_lastAccrualMonth_idx" ON "Debt"("lastAccrualMonth");

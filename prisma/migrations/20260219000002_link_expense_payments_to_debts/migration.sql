-- Link expense payments to debts (credit cards) so credit-card spending can update card balances globally.

ALTER TABLE "ExpensePayment"
ADD COLUMN IF NOT EXISTS "debtId" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ExpensePayment_debtId_fkey'
  ) THEN
    ALTER TABLE "ExpensePayment"
    ADD CONSTRAINT "ExpensePayment_debtId_fkey"
    FOREIGN KEY ("debtId") REFERENCES "Debt"("id")
    ON DELETE SET NULL
    ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "ExpensePayment_debtId_idx" ON "ExpensePayment"("debtId");

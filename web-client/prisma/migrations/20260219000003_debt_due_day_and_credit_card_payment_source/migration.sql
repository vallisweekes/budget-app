-- Add debt due day + default payment source/card and allow debt payments to be sourced from a credit card.

-- 1) Extend enum DebtPaymentSource
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'DebtPaymentSource'
      AND e.enumlabel = 'credit_card'
  ) THEN
    ALTER TYPE "DebtPaymentSource" ADD VALUE 'credit_card';
  END IF;
END $$;

-- 2) Debt: due day + defaults
ALTER TABLE "Debt"
  ADD COLUMN IF NOT EXISTS "dueDay" INTEGER;

ALTER TABLE "Debt"
  ADD COLUMN IF NOT EXISTS "defaultPaymentSource" "DebtPaymentSource" NOT NULL DEFAULT 'income';

ALTER TABLE "Debt"
  ADD COLUMN IF NOT EXISTS "defaultPaymentCardDebtId" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'Debt_defaultPaymentCardDebtId_fkey'
  ) THEN
    ALTER TABLE "Debt"
      ADD CONSTRAINT "Debt_defaultPaymentCardDebtId_fkey"
      FOREIGN KEY ("defaultPaymentCardDebtId") REFERENCES "Debt"("id")
      ON DELETE SET NULL
      ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "Debt_defaultPaymentCardDebtId_idx" ON "Debt"("defaultPaymentCardDebtId");

-- 3) DebtPayment: optional link to credit card used
ALTER TABLE "DebtPayment"
  ADD COLUMN IF NOT EXISTS "cardDebtId" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'DebtPayment_cardDebtId_fkey'
  ) THEN
    ALTER TABLE "DebtPayment"
      ADD CONSTRAINT "DebtPayment_cardDebtId_fkey"
      FOREIGN KEY ("cardDebtId") REFERENCES "Debt"("id")
      ON DELETE SET NULL
      ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "DebtPayment_cardDebtId_idx" ON "DebtPayment"("cardDebtId");

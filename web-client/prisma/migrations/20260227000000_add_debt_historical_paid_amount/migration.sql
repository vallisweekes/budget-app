-- Add optional per-debt baseline of payments made before tracking in-app.
-- This value is included in Debt.paidAmount reconciliation, but does not create DebtPayment rows.

ALTER TABLE "Debt"
ADD COLUMN "historicalPaidAmount" DECIMAL(12,2) NOT NULL DEFAULT 0;

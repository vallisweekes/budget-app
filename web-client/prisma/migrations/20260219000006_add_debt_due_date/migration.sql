-- Add full due date to debts (calendar date, like expenses).
ALTER TABLE "Debt"
  ADD COLUMN IF NOT EXISTS "dueDate" TIMESTAMP(3);

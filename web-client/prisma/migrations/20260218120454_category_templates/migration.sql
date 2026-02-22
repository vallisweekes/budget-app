-- CreateEnum
CREATE TYPE "ExpensePaymentSource" AS ENUM ('income', 'savings', 'emergency', 'extra_untracked');

-- CreateTable
CREATE TABLE "CategoryTemplate" (
    "id" TEXT NOT NULL,
    "kindKey" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT,
    "color" TEXT,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CategoryTemplate_pkey" PRIMARY KEY ("id")
);

-- Seed default category templates (editable in DB later).
-- NOTE: ids are arbitrary stable strings (Prisma generates ids for new rows).
INSERT INTO "CategoryTemplate" ("id", "kindKey", "name", "icon", "color", "featured", "sortOrder", "isActive", "updatedAt") VALUES
    -- base (applies to all plans)
    ('ct_base_001', 'base', 'Carnival', 'PartyPopper', 'pink', true, 10, true, CURRENT_TIMESTAMP),
    ('ct_base_002', 'base', 'Business Trip', 'Briefcase', 'slate', true, 20, true, CURRENT_TIMESTAMP),
    ('ct_base_003', 'base', 'Childcare', 'Baby', 'pink', true, 30, true, CURRENT_TIMESTAMP),
    ('ct_base_004', 'base', 'Custom', 'Star', 'amber', true, 40, true, CURRENT_TIMESTAMP),
    ('ct_base_005', 'base', 'Entertainment', 'Gamepad2', 'red', true, 50, true, CURRENT_TIMESTAMP),
    ('ct_base_006', 'base', 'Food & Dining', 'UtensilsCrossed', 'green', true, 60, true, CURRENT_TIMESTAMP),
    ('ct_base_007', 'base', 'Holiday', 'Palmtree', 'teal', true, 70, true, CURRENT_TIMESTAMP),
    ('ct_base_008', 'base', 'Housing', 'Home', 'blue', true, 80, true, CURRENT_TIMESTAMP),
    ('ct_base_009', 'base', 'Insurance', 'Shield', 'indigo', true, 90, true, CURRENT_TIMESTAMP),
    ('ct_base_010', 'base', 'Investments', 'TrendingUp', 'purple', true, 100, true, CURRENT_TIMESTAMP),
    ('ct_base_011', 'base', 'Personal Care', 'Scissors', 'cyan', true, 110, true, CURRENT_TIMESTAMP),
    ('ct_base_012', 'base', 'Savings', 'PiggyBank', 'emerald', true, 120, true, CURRENT_TIMESTAMP),
    ('ct_base_013', 'base', 'Subscriptions', 'Smartphone', 'purple', true, 130, true, CURRENT_TIMESTAMP),
    ('ct_base_014', 'base', 'Transport', 'Car', 'orange', true, 140, true, CURRENT_TIMESTAMP),
    ('ct_base_015', 'base', 'Utilities', 'Zap', 'yellow', true, 150, true, CURRENT_TIMESTAMP),

    -- personal-only
    ('ct_personal_001', 'personal', 'Fees & Charges', 'Receipt', 'slate', false, 10, true, CURRENT_TIMESTAMP),

    -- carnival-only
    ('ct_carnival_001', 'carnival', 'Costumes', 'Shirt', 'pink', true, 10, true, CURRENT_TIMESTAMP),
    ('ct_carnival_002', 'carnival', 'Events Tickets', 'Ticket', 'amber', true, 20, true, CURRENT_TIMESTAMP),
    ('ct_carnival_003', 'carnival', 'Jouvert Package', 'Package', 'violet', true, 30, true, CURRENT_TIMESTAMP),
    ('ct_carnival_004', 'carnival', 'Transport', 'Car', 'sky', false, 40, true, CURRENT_TIMESTAMP),
    ('ct_carnival_005', 'carnival', 'Accommodation', 'Home', 'emerald', false, 50, true, CURRENT_TIMESTAMP),
    ('ct_carnival_006', 'carnival', 'Flights', 'Plane', 'cyan', false, 60, true, CURRENT_TIMESTAMP),
    ('ct_carnival_007', 'carnival', 'Spending Money', 'Wallet', 'slate', false, 70, true, CURRENT_TIMESTAMP),
    ('ct_carnival_008', 'carnival', 'Drinks and Food', 'Utensils', 'orange', false, 80, true, CURRENT_TIMESTAMP),
    ('ct_carnival_009', 'carnival', 'Rental', 'Key', 'indigo', false, 90, true, CURRENT_TIMESTAMP),
    ('ct_carnival_010', 'carnival', 'Other', 'DotsHorizontal', 'slate', false, 100, true, CURRENT_TIMESTAMP),

    -- holiday-only
    ('ct_holiday_001', 'holiday', 'Activities', 'Sparkles', 'pink', true, 10, true, CURRENT_TIMESTAMP),
    ('ct_holiday_002', 'holiday', 'Tours', 'Map', 'amber', true, 20, true, CURRENT_TIMESTAMP),
    ('ct_holiday_003', 'holiday', 'Spending Money', 'Wallet', 'slate', false, 30, true, CURRENT_TIMESTAMP),
    ('ct_holiday_004', 'holiday', 'Accommodation', 'Home', 'emerald', false, 40, true, CURRENT_TIMESTAMP),
    ('ct_holiday_005', 'holiday', 'Flights', 'Plane', 'cyan', false, 50, true, CURRENT_TIMESTAMP),
    ('ct_holiday_006', 'holiday', 'Rental', 'Key', 'indigo', false, 60, true, CURRENT_TIMESTAMP);

-- CreateTable
CREATE TABLE "ExpensePayment" (
    "id" TEXT NOT NULL,
    "expenseId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "source" "ExpensePaymentSource" NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExpensePayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CategoryTemplate_kindKey_isActive_sortOrder_idx" ON "CategoryTemplate"("kindKey", "isActive", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "CategoryTemplate_kindKey_name_key" ON "CategoryTemplate"("kindKey", "name");

-- CreateIndex
CREATE INDEX "ExpensePayment_expenseId_idx" ON "ExpensePayment"("expenseId");

-- CreateIndex
CREATE INDEX "ExpensePayment_paidAt_idx" ON "ExpensePayment"("paidAt");

-- CreateIndex
CREATE INDEX "ExpensePayment_source_idx" ON "ExpensePayment"("source");

-- AddForeignKey
ALTER TABLE "ExpensePayment" ADD CONSTRAINT "ExpensePayment_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "Expense" ADD COLUMN     "cardDebtId" TEXT,
ADD COLUMN     "paymentSource" "ExpensePaymentSource" DEFAULT 'income';

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_cardDebtId_fkey" FOREIGN KEY ("cardDebtId") REFERENCES "Debt"("id") ON DELETE SET NULL ON UPDATE CASCADE;

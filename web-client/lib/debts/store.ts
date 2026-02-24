export type { DebtItem, DebtPayment } from "@/types";

export {
	getAllDebts,
	getDebtById,
	getPaymentsByDebt,
	getPaymentsByMonth,
	getTotalDebtBalance,
} from "@/lib/debts/store/read-queries";
export { addDebt, upsertExpenseDebt, updateDebt, deleteDebt } from "@/lib/debts/store/debt-mutations";
export { addPayment } from "@/lib/debts/store/payment-add";
export { undoMostRecentPayment } from "@/lib/debts/store/payment-undo";

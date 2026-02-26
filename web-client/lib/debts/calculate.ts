import type { DebtItem } from "@/types";

/**
 * Calculate the effective monthly payment for a debt
 *
 * Notes:
 * - `debt.amount` is treated as the planned monthly payment (what the user expects to pay each month).
 * - `installmentMonths` is used to *suggest* a payment only when `amount` isn't set.
 * - `monthlyMinimum` (when set) floors the payment.
 */
export function getDebtMonthlyPayment(debt: DebtItem): number {
	const rawPlanned = typeof debt.amount === "number" ? debt.amount : Number(debt.amount);
	let planned = Number.isFinite(rawPlanned) ? rawPlanned : 0;

	// Fallback: compute a suggested installment only when `amount` isn't set.
	if (!(planned > 0) && debt.installmentMonths && debt.installmentMonths > 0) {
		const principal = (debt.initialBalance ?? 0) > 0 ? (debt.initialBalance as number) : debt.currentBalance;
		if (Number.isFinite(principal) && principal > 0) {
			planned = principal / debt.installmentMonths;
		}
	}

	const rawMin = typeof debt.monthlyMinimum === "number" ? debt.monthlyMinimum : Number(debt.monthlyMinimum);
	const monthlyMin = Number.isFinite(rawMin) ? rawMin : 0;
	if (monthlyMin > 0) planned = Math.max(planned, monthlyMin);

	return Math.max(0, planned);
}

/**
 * Calculate total monthly debt payments for all debts
 */
export function getTotalMonthlyDebtPayments(debts: DebtItem[]): number {
	return debts.reduce((total, debt) => {
		if (debt.paid || debt.currentBalance <= 0) return total;
		return total + getDebtMonthlyPayment(debt);
	}, 0);
}

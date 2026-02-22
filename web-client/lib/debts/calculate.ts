import type { DebtItem } from "@/types";

/**
 * Calculate the effective monthly payment for a debt
 * If installmentMonths is set, returns currentBalance / installmentMonths
 * If monthlyMinimum is set, returns the greater of installment or minimum
 * Otherwise returns the manually set amount
 */
export function getDebtMonthlyPayment(debt: DebtItem): number {
	// If installment plan is active, calculate monthly installment
	if (debt.installmentMonths && debt.installmentMonths > 0 && debt.currentBalance > 0) {
		const installmentAmount = debt.currentBalance / debt.installmentMonths;
		
		// If monthly minimum is set, use the greater of the two
		if (debt.monthlyMinimum && debt.monthlyMinimum > installmentAmount) {
			return debt.monthlyMinimum;
		}
		
		return installmentAmount;
	}
	
	// If no installment but monthly minimum is set, use that
	if (debt.monthlyMinimum) {
		return debt.monthlyMinimum;
	}
	
	// Otherwise use the manually set amount
	return debt.amount || 0;
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

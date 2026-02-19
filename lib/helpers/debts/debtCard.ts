import type { DebtCardDebt } from "@/types/components/debts";

export function canDeleteDebt(debt: DebtCardDebt): boolean {
	return !(debt.sourceType === "expense" && debt.currentBalance > 0);
}

export function getPercentPaid(debt: DebtCardDebt): number {
	if (debt.initialBalance <= 0) return 0;
	return ((debt.initialBalance - debt.currentBalance) / debt.initialBalance) * 100;
}

export function getPaymentMonthKeyUTC(now: Date = new Date()): string {
	const y = now.getUTCFullYear();
	const m = String(now.getUTCMonth() + 1).padStart(2, "0");
	return `${y}-${m}`;
}

export function getDaysUntilPayday(now: Date, payDate: number): number {
	const currentDay = now.getDate();
	const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
	return payDate >= currentDay ? payDate - currentDay : daysInMonth - currentDay + payDate;
}

export function isNearPaydayDebt(debt: DebtCardDebt, daysUntilPayday: number): boolean {
	return daysUntilPayday <= 3 && debt.amount > 0;
}

export function computeInstallmentDueAmount(params: {
	currentBalance: number;
	installmentMonths: number;
	monthlyMinimum?: number;
}): number {
	const { currentBalance, installmentMonths, monthlyMinimum } = params;
	if (!Number.isFinite(currentBalance) || currentBalance <= 0) return 0;
	if (!Number.isFinite(installmentMonths) || installmentMonths <= 0) return 0;

	const base = currentBalance / installmentMonths;
	const min = Number.isFinite(monthlyMinimum) && (monthlyMinimum ?? 0) > 0 ? (monthlyMinimum as number) : 0;
	return Math.max(base, min);
}

export function buildDebtUpdateFormData(params: {
	budgetPlanId: string;
	name: string;
	initialBalance: string;
	currentBalance: string;
	amount: string;
	creditLimit?: string;
	monthlyMinimum?: string;
	interestRate?: string;
	installmentMonths?: string;
}): FormData {
	const formData = new FormData();
	formData.append("budgetPlanId", params.budgetPlanId);
	formData.append("name", params.name);
	formData.append("initialBalance", params.initialBalance);
	formData.append("currentBalance", params.currentBalance);
	formData.append("amount", params.amount);
	if (typeof params.creditLimit === "string") formData.append("creditLimit", params.creditLimit);
	if (params.monthlyMinimum) formData.append("monthlyMinimum", params.monthlyMinimum);
	if (params.interestRate) formData.append("interestRate", params.interestRate);
	if (params.installmentMonths) formData.append("installmentMonths", params.installmentMonths);
	return formData;
}

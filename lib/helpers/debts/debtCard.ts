import type { DebtCardDebt } from "@/types/components/debts";
import type { DebtPayment } from "@/types";

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

function parseMonthKey(key: string): { year: number; month: number } | null {
	const match = String(key ?? "").trim().match(/^([0-9]{4})-([0-9]{2})$/);
	if (!match) return null;
	const year = Number(match[1]);
	const month = Number(match[2]);
	if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) return null;
	return { year, month };
}

function monthKeyFromYearMonth(year: number, month: number): string {
	const y = String(year).padStart(4, "0");
	const m = String(month).padStart(2, "0");
	return `${y}-${m}`;
}

function prevMonthKey(key: string): string {
	const parsed = parseMonthKey(key);
	if (!parsed) return key;
	let { year, month } = parsed;
	month -= 1;
	if (month < 1) {
		month = 12;
		year -= 1;
	}
	return monthKeyFromYearMonth(year, month);
}

function diffMonths(fromKey: string, toKey: string): number {
	const from = parseMonthKey(fromKey);
	const to = parseMonthKey(toKey);
	if (!from || !to) return 0;
	return (to.year - from.year) * 12 + (to.month - from.month);
}

export function computeAccumulatedDueNow(params: {
	debt: DebtCardDebt;
	payments: DebtPayment[];
	now?: Date;
}): { dueNowAmount: number; monthsDue: number; note?: string } {
	const { debt, payments } = params;
	const now = params.now ?? new Date();

	// Only apply simple accumulation to standing-order debts.
	if (!debt.dueDay || debt.sourceType === "expense") {
		return { dueNowAmount: debt.amount, monthsDue: 1 };
	}

	const currentKey = getPaymentMonthKeyUTC(now);
	const effectiveKey = now.getUTCDate() < debt.dueDay ? prevMonthKey(currentKey) : currentKey;

	const lastPaidKey = payments
		.map((p) => p.month)
		.filter((k): k is string => /^\d{4}-\d{2}$/.test(String(k)))
		.sort()
		.at(-1);

	let monthsDue = 1;
	if (lastPaidKey) {
		monthsDue = Math.max(1, diffMonths(lastPaidKey, effectiveKey));
	} else if (debt.createdAt) {
		const createdKey = getPaymentMonthKeyUTC(new Date(debt.createdAt));
		monthsDue = Math.max(1, diffMonths(createdKey, effectiveKey) + 1);
	}

	let dueNowAmount = debt.amount * monthsDue;
	if (Number.isFinite(debt.currentBalance) && debt.currentBalance > 0) {
		dueNowAmount = Math.min(dueNowAmount, debt.currentBalance);
	}

	return monthsDue > 1
		? { dueNowAmount, monthsDue, note: `${monthsDue} months due` }
		: { dueNowAmount, monthsDue };
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
	dueDay?: string;
	defaultPaymentSource?: string;
	defaultPaymentCardDebtId?: string;
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
	if (typeof params.dueDay === "string" && params.dueDay.trim() !== "") formData.append("dueDay", params.dueDay);
	if (typeof params.defaultPaymentSource === "string" && params.defaultPaymentSource.trim() !== "") {
		formData.append("defaultPaymentSource", params.defaultPaymentSource);
	}
	if (typeof params.defaultPaymentCardDebtId === "string" && params.defaultPaymentCardDebtId.trim() !== "") {
		formData.append("defaultPaymentCardDebtId", params.defaultPaymentCardDebtId);
	}
	if (typeof params.creditLimit === "string" && params.creditLimit.trim() !== "") {
		formData.append("creditLimit", params.creditLimit);
	}
	if (params.monthlyMinimum) formData.append("monthlyMinimum", params.monthlyMinimum);
	if (params.interestRate) formData.append("interestRate", params.interestRate);
	if (params.installmentMonths) formData.append("installmentMonths", params.installmentMonths);
	return formData;
}

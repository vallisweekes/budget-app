import fs from "fs";
import path from "path";
import type { DebtItem, DebtPayment } from "@/types";
import { getBudgetDataDir, getBudgetDataFilePath } from "@/lib/storage/budgetDataPath";

export type { DebtItem, DebtPayment };

function debtsFilePath(budgetPlanId: string) {
	return getBudgetDataFilePath(budgetPlanId, "debts.json");
}

function paymentsFilePath(budgetPlanId: string) {
	return getBudgetDataFilePath(budgetPlanId, "debt-payments.json");
}


function ensureDataDir(budgetPlanId: string) {
	const dir = getBudgetDataDir(budgetPlanId);
	if (!fs.existsSync(dir)) {
		fs.mkdirSync(dir, { recursive: true });
	}
}

function readDebts(budgetPlanId: string): DebtItem[] {
	ensureDataDir(budgetPlanId);
	const file = debtsFilePath(budgetPlanId);
	if (!fs.existsSync(file)) {
		return [];
	}
	const raw = fs.readFileSync(file, "utf-8");
	return JSON.parse(raw);
}

function writeDebts(budgetPlanId: string, debts: DebtItem[]) {
	ensureDataDir(budgetPlanId);
	fs.writeFileSync(debtsFilePath(budgetPlanId), JSON.stringify(debts, null, 2));
}

function readPayments(budgetPlanId: string): DebtPayment[] {
	ensureDataDir(budgetPlanId);
	const file = paymentsFilePath(budgetPlanId);
	if (!fs.existsSync(file)) {
		return [];
	}
	const raw = fs.readFileSync(file, "utf-8");
	return JSON.parse(raw);
}

function writePayments(budgetPlanId: string, payments: DebtPayment[]) {
	ensureDataDir(budgetPlanId);
	fs.writeFileSync(paymentsFilePath(budgetPlanId), JSON.stringify(payments, null, 2));
}

export function getAllDebts(budgetPlanId: string): DebtItem[] {
	return readDebts(budgetPlanId);
}

export function getDebtById(budgetPlanId: string, id: string): DebtItem | undefined {
	const debts = readDebts(budgetPlanId);
	return debts.find(d => d.id === id);
}

export function addDebt(
	budgetPlanId: string,
	debt: Omit<DebtItem, "id" | "createdAt" | "currentBalance" | "paid" | "paidAmount" | "amount">
): DebtItem {
	const debts = readDebts(budgetPlanId);
	const newDebt: DebtItem = {
		...debt,
		id: Date.now().toString(),
		currentBalance: debt.initialBalance,
		paid: false,
		paidAmount: 0,
		amount: debt.initialBalance,
		createdAt: new Date().toISOString(),
	};
	debts.push(newDebt);
	writeDebts(budgetPlanId, debts);
	return newDebt;
}

export function upsertExpenseDebt(params: {
	budgetPlanId: string;
	expenseId: string;
	monthKey: string;
	year?: number;
	categoryId?: string;
	categoryName?: string;
	expenseName: string;
	remainingAmount: number;
}): DebtItem | null {
	const {
		budgetPlanId,
		expenseId,
		monthKey,
		year,
		categoryId,
		categoryName,
		expenseName,
		remainingAmount,
	} = params;

	const debts = readDebts(budgetPlanId);
	const existing = debts.find(
		(d) => d.sourceType === "expense" && d.sourceExpenseId === expenseId && d.sourceMonthKey === monthKey
	);

	if (!Number.isFinite(remainingAmount) || remainingAmount <= 0) {
		if (existing) {
			// Keep the debt record (and any payment history), but mark it settled
			const updated = updateDebt(budgetPlanId, existing.id, {
				currentBalance: 0,
				paid: true,
				paidAmount: existing.initialBalance,
			});
			return updated;
		}
		return null;
	}

	if (existing) {
		const updated = updateDebt(budgetPlanId, existing.id, {
			currentBalance: remainingAmount,
			paid: false,
			paidAmount: Math.max(0, existing.initialBalance - remainingAmount),
			name: existing.name,
			sourceYear: year ?? existing.sourceYear,
			sourceCategoryId: categoryId ?? existing.sourceCategoryId,
			sourceCategoryName: categoryName ?? existing.sourceCategoryName,
			sourceExpenseName: expenseName ?? existing.sourceExpenseName,
		});
		return updated;
	}

	const displayCategory = categoryName ? `${categoryName}: ` : "";
	const displayPeriod = year ? ` (${monthKey} ${year})` : ` (${monthKey})`;
	const name = `${displayCategory}${expenseName}${displayPeriod}`;

	return addDebt(budgetPlanId, {
		name,
		type: "high_purchase",
		initialBalance: remainingAmount,
		sourceType: "expense",
		sourceExpenseId: expenseId,
		sourceMonthKey: monthKey,
		sourceYear: year,
		sourceCategoryId: categoryId,
		sourceCategoryName: categoryName,
		sourceExpenseName: expenseName,
	});
}

export function updateDebt(budgetPlanId: string, id: string, updates: Partial<Omit<DebtItem, "id" | "createdAt">>): DebtItem | null {
	const debts = readDebts(budgetPlanId);
	const index = debts.findIndex(d => d.id === id);
	if (index === -1) return null;
	
	debts[index] = { ...debts[index], ...updates };
	writeDebts(budgetPlanId, debts);
	return debts[index];
}

export function deleteDebt(budgetPlanId: string, id: string): boolean {
	const debts = readDebts(budgetPlanId);
	const filtered = debts.filter(d => d.id !== id);
	if (filtered.length === debts.length) return false;
	
	writeDebts(budgetPlanId, filtered);
	
	// Also delete related payments
	const payments = readPayments(budgetPlanId);
	const filteredPayments = payments.filter(p => p.debtId !== id);
	writePayments(budgetPlanId, filteredPayments);
	
	return true;
}

export function addPayment(budgetPlanId: string, debtId: string, amount: number, month: string): DebtPayment | null {
	const debt = getDebtById(budgetPlanId, debtId);
	if (!debt) return null;
	
	const payments = readPayments(budgetPlanId);
	const newPayment: DebtPayment = {
		id: Date.now().toString(),
		debtId,
		amount,
		date: new Date().toISOString(),
		month,
	};
	
	payments.push(newPayment);
	writePayments(budgetPlanId, payments);
	
	// Update debt balance and paid amount
	const newBalance = Math.max(0, debt.currentBalance - amount);
	const newPaidAmount = (debt.paidAmount || 0) + amount;
	updateDebt(budgetPlanId, debtId, { 
		currentBalance: newBalance,
		paidAmount: newPaidAmount,
		paid: newBalance === 0,
	});
	
	return newPayment;
}

export function getPaymentsByDebt(budgetPlanId: string, debtId: string): DebtPayment[] {
	const payments = readPayments(budgetPlanId);
	return payments.filter(p => p.debtId === debtId);
}

export function getPaymentsByMonth(budgetPlanId: string, month: string): DebtPayment[] {
	const payments = readPayments(budgetPlanId);
	return payments.filter(p => p.month === month);
}

export function getTotalDebtBalance(budgetPlanId: string): number {
	const debts = readDebts(budgetPlanId);
	return debts.reduce((sum, debt) => sum + debt.currentBalance, 0);
}

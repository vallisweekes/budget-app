import fs from "fs";
import path from "path";

export interface DebtItem {
	id: string;
	name: string;
	type: "credit_card" | "loan" | "high_purchase";
	initialBalance: number;
	currentBalance: number;
	monthlyMinimum?: number;
	interestRate?: number;
	paid: boolean;
	paidAmount: number;
	amount: number; // alias for initialBalance for compatibility
	createdAt: string;
	// Optional linkage to an originating expense (used for unpaid/partial expenses)
	sourceType?: "expense";
	sourceExpenseId?: string;
	sourceMonthKey?: string;
	sourceYear?: number;
	sourceCategoryId?: string;
	sourceCategoryName?: string;
	sourceExpenseName?: string;
}

export interface DebtPayment {
	id: string;
	debtId: string;
	amount: number;
	date: string;
	month: string; // e.g., "2026-02"
}

const DEBTS_FILE = path.join(process.cwd(), "data", "debts.json");
const PAYMENTS_FILE = path.join(process.cwd(), "data", "debt-payments.json");

function ensureDataDir() {
	const dir = path.dirname(DEBTS_FILE);
	if (!fs.existsSync(dir)) {
		fs.mkdirSync(dir, { recursive: true });
	}
}

function readDebts(): DebtItem[] {
	ensureDataDir();
	if (!fs.existsSync(DEBTS_FILE)) {
		return [];
	}
	const raw = fs.readFileSync(DEBTS_FILE, "utf-8");
	return JSON.parse(raw);
}

function writeDebts(debts: DebtItem[]) {
	ensureDataDir();
	fs.writeFileSync(DEBTS_FILE, JSON.stringify(debts, null, 2));
}

function readPayments(): DebtPayment[] {
	ensureDataDir();
	if (!fs.existsSync(PAYMENTS_FILE)) {
		return [];
	}
	const raw = fs.readFileSync(PAYMENTS_FILE, "utf-8");
	return JSON.parse(raw);
}

function writePayments(payments: DebtPayment[]) {
	ensureDataDir();
	fs.writeFileSync(PAYMENTS_FILE, JSON.stringify(payments, null, 2));
}

export function getAllDebts(): DebtItem[] {
	return readDebts();
}

export function getDebtById(id: string): DebtItem | undefined {
	const debts = readDebts();
	return debts.find(d => d.id === id);
}

export function addDebt(debt: Omit<DebtItem, "id" | "createdAt" | "currentBalance" | "paid" | "paidAmount" | "amount">): DebtItem {
	const debts = readDebts();
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
	writeDebts(debts);
	return newDebt;
}

export function upsertExpenseDebt(params: {
	expenseId: string;
	monthKey: string;
	year?: number;
	categoryId?: string;
	categoryName?: string;
	expenseName: string;
	remainingAmount: number;
}): DebtItem | null {
	const {
		expenseId,
		monthKey,
		year,
		categoryId,
		categoryName,
		expenseName,
		remainingAmount,
	} = params;

	const debts = readDebts();
	const existing = debts.find(
		(d) => d.sourceType === "expense" && d.sourceExpenseId === expenseId && d.sourceMonthKey === monthKey
	);

	if (!Number.isFinite(remainingAmount) || remainingAmount <= 0) {
		if (existing) {
			// Keep the debt record (and any payment history), but mark it settled
			const updated = updateDebt(existing.id, {
				currentBalance: 0,
				paid: true,
				paidAmount: existing.initialBalance,
			});
			return updated;
		}
		return null;
	}

	if (existing) {
		const updated = updateDebt(existing.id, {
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

	return addDebt({
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

export function updateDebt(id: string, updates: Partial<Omit<DebtItem, "id" | "createdAt">>): DebtItem | null {
	const debts = readDebts();
	const index = debts.findIndex(d => d.id === id);
	if (index === -1) return null;
	
	debts[index] = { ...debts[index], ...updates };
	writeDebts(debts);
	return debts[index];
}

export function deleteDebt(id: string): boolean {
	const debts = readDebts();
	const filtered = debts.filter(d => d.id !== id);
	if (filtered.length === debts.length) return false;
	
	writeDebts(filtered);
	
	// Also delete related payments
	const payments = readPayments();
	const filteredPayments = payments.filter(p => p.debtId !== id);
	writePayments(filteredPayments);
	
	return true;
}

export function addPayment(debtId: string, amount: number, month: string): DebtPayment | null {
	const debt = getDebtById(debtId);
	if (!debt) return null;
	
	const payments = readPayments();
	const newPayment: DebtPayment = {
		id: Date.now().toString(),
		debtId,
		amount,
		date: new Date().toISOString(),
		month,
	};
	
	payments.push(newPayment);
	writePayments(payments);
	
	// Update debt balance
	const newBalance = Math.max(0, debt.currentBalance - amount);
	updateDebt(debtId, { currentBalance: newBalance });
	
	return newPayment;
}

export function getPaymentsByDebt(debtId: string): DebtPayment[] {
	const payments = readPayments();
	return payments.filter(p => p.debtId === debtId);
}

export function getPaymentsByMonth(month: string): DebtPayment[] {
	const payments = readPayments();
	return payments.filter(p => p.month === month);
}

export function getTotalDebtBalance(): number {
	const debts = readDebts();
	return debts.reduce((sum, debt) => sum + debt.currentBalance, 0);
}

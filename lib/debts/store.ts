import type { DebtItem, DebtPayment } from "@/types";
import { prisma } from "@/lib/prisma";
import { monthKeyToNumber } from "@/lib/helpers/monthKey";
import type { MonthKey } from "@/types";

export type { DebtItem, DebtPayment };

function prismaDebtHasField(fieldName: string): boolean {
	try {
		const fields = (prisma as any)?._runtimeDataModel?.models?.Debt?.fields;
		if (!Array.isArray(fields)) return false;
		return fields.some((f: any) => f?.name === fieldName);
	} catch {
		return false;
	}
}

// Dev safety: Turbopack can run with a stale Prisma Client after schema changes.
// Only select/write fields when the runtime client supports them.
const DEBT_HAS_CREDIT_LIMIT = prismaDebtHasField("creditLimit");
const DEBT_HAS_DUE_DAY = prismaDebtHasField("dueDay");
const DEBT_HAS_DUE_DATE = prismaDebtHasField("dueDate");
const DEBT_HAS_DEFAULT_PAYMENT_SOURCE = prismaDebtHasField("defaultPaymentSource");
const DEBT_HAS_DEFAULT_PAYMENT_CARD_DEBT_ID = prismaDebtHasField("defaultPaymentCardDebtId");

function prismaDebtPaymentHasField(fieldName: string): boolean {
	try {
		const fields = (prisma as any)?._runtimeDataModel?.models?.DebtPayment?.fields;
		if (!Array.isArray(fields)) return false;
		return fields.some((f: any) => f?.name === fieldName);
	} catch {
		return false;
	}
}

const DEBT_PAYMENT_HAS_CARD_DEBT_ID = prismaDebtPaymentHasField("cardDebtId");

function decimalToNumber(value: unknown): number {
	if (value == null) return 0;
	if (typeof value === "number") return value;
	return Number((value as any).toString?.() ?? value);
}

function paymentMonthKeyFromDate(date: Date): string {
	const y = date.getUTCFullYear();
	const m = String(date.getUTCMonth() + 1).padStart(2, "0");
	return `${y}-${m}`;
}

function parseYearMonthKey(value: string | undefined): { year: number; month: number } | null {
	const raw = String(value ?? "").trim();
	const match = raw.match(/^([0-9]{4})-([0-9]{2})$/);
	if (!match) return null;
	const year = Number(match[1]);
	const month = Number(match[2]);
	if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) return null;
	return { year, month };
}

async function resolveBudgetYear(budgetPlanId: string): Promise<number> {
	const latestIncome = await prisma.income.findFirst({
		where: { budgetPlanId },
		orderBy: [{ year: "desc" }, { month: "desc" }],
		select: { year: true },
	});
	if (latestIncome?.year) return latestIncome.year;
	const latestExpense = await prisma.expense.findFirst({
		where: { budgetPlanId },
		orderBy: [{ year: "desc" }, { month: "desc" }],
		select: { year: true },
	});
	return latestExpense?.year ?? new Date().getFullYear();
}

function serializeDebt(row: {
	id: string;
	name: string;
	type: string;
	creditLimit?: unknown | null;
	dueDay?: number | null;
	dueDate?: Date | null;
	initialBalance: unknown;
	currentBalance: unknown;
	amount: unknown;
	paid: boolean;
	paidAmount: unknown;
	defaultPaymentSource?: unknown | null;
	defaultPaymentCardDebtId?: string | null;
	monthlyMinimum: unknown | null;
	interestRate: unknown | null;
	installmentMonths: number | null;
	createdAt: Date;
	sourceType: string | null;
	sourceExpenseId: string | null;
	sourceMonthKey: string | null;
	sourceCategoryId: string | null;
	sourceCategoryName: string | null;
	sourceExpenseName: string | null;
}): DebtItem {
	return {
		id: row.id,
		name: row.name,
		type: row.type as any,
		creditLimit: row.creditLimit == null ? undefined : decimalToNumber(row.creditLimit),
		dueDay: row.dueDay == null ? undefined : Number(row.dueDay),
		dueDate: row.dueDate == null ? undefined : row.dueDate.toISOString(),
		initialBalance: decimalToNumber(row.initialBalance),
		currentBalance: decimalToNumber(row.currentBalance),
		amount: decimalToNumber(row.amount),
		paid: row.paid,
		paidAmount: decimalToNumber(row.paidAmount),
		defaultPaymentSource:
			row.defaultPaymentSource === "credit_card"
				? "credit_card"
				: row.defaultPaymentSource === "extra_funds"
					? "extra_funds"
					: row.defaultPaymentSource === "income"
						? "income"
						: undefined,
		defaultPaymentCardDebtId: row.defaultPaymentCardDebtId ?? undefined,
		monthlyMinimum: row.monthlyMinimum == null ? undefined : decimalToNumber(row.monthlyMinimum),
		interestRate: row.interestRate == null ? undefined : decimalToNumber(row.interestRate),
		installmentMonths: row.installmentMonths ?? undefined,
		createdAt: row.createdAt.toISOString(),
		sourceType: row.sourceType === "expense" ? "expense" : undefined,
		sourceExpenseId: row.sourceExpenseId ?? undefined,
		sourceMonthKey: row.sourceMonthKey ?? undefined,
		sourceCategoryId: row.sourceCategoryId ?? undefined,
		sourceCategoryName: row.sourceCategoryName ?? undefined,
		sourceExpenseName: row.sourceExpenseName ?? undefined,
	};
}

function serializePayment(row: {
	id: string;
	debtId: string;
	amount: unknown;
	paidAt: Date;
	source?: unknown;
	cardDebtId?: string | null;
}): DebtPayment {
	return {
		id: row.id,
		debtId: row.debtId,
		amount: decimalToNumber(row.amount),
		date: row.paidAt.toISOString(),
		month: paymentMonthKeyFromDate(row.paidAt),
		source:
			row.source === "credit_card"
				? "credit_card"
				: row.source === "extra_funds"
					? "extra_funds"
					: row.source === "income"
						? "income"
						: undefined,
		cardDebtId: row.cardDebtId ?? undefined,
	};
}

export async function getAllDebts(budgetPlanId: string): Promise<DebtItem[]> {
	const rows = await prisma.debt.findMany({
		where: { budgetPlanId },
		orderBy: [{ createdAt: "asc" }],
		select: {
			id: true,
			name: true,
			type: true,
			...(DEBT_HAS_CREDIT_LIMIT ? { creditLimit: true } : {}),
			...(DEBT_HAS_DUE_DAY ? { dueDay: true } : {}),
			...(DEBT_HAS_DUE_DATE ? { dueDate: true } : {}),
			initialBalance: true,
			currentBalance: true,
			amount: true,
			paid: true,
			paidAmount: true,
			...(DEBT_HAS_DEFAULT_PAYMENT_SOURCE ? { defaultPaymentSource: true } : {}),
			...(DEBT_HAS_DEFAULT_PAYMENT_CARD_DEBT_ID ? { defaultPaymentCardDebtId: true } : {}),
			monthlyMinimum: true,
			interestRate: true,
			installmentMonths: true,
			createdAt: true,
			sourceType: true,
			sourceExpenseId: true,
			sourceMonthKey: true,
			sourceCategoryId: true,
			sourceCategoryName: true,
			sourceExpenseName: true,
		},
	});
	return rows.map(serializeDebt);
}

export async function getDebtById(budgetPlanId: string, id: string): Promise<DebtItem | undefined> {
	const row = await prisma.debt.findFirst({
		where: { id, budgetPlanId },
		select: {
			id: true,
			name: true,
			type: true,
			...(DEBT_HAS_CREDIT_LIMIT ? { creditLimit: true } : {}),
			...(DEBT_HAS_DUE_DAY ? { dueDay: true } : {}),
			...(DEBT_HAS_DUE_DATE ? { dueDate: true } : {}),
			initialBalance: true,
			currentBalance: true,
			amount: true,
			paid: true,
			paidAmount: true,
			...(DEBT_HAS_DEFAULT_PAYMENT_SOURCE ? { defaultPaymentSource: true } : {}),
			...(DEBT_HAS_DEFAULT_PAYMENT_CARD_DEBT_ID ? { defaultPaymentCardDebtId: true } : {}),
			monthlyMinimum: true,
			interestRate: true,
			installmentMonths: true,
			createdAt: true,
			sourceType: true,
			sourceExpenseId: true,
			sourceMonthKey: true,
			sourceCategoryId: true,
			sourceCategoryName: true,
			sourceExpenseName: true,
		},
	});
	return row ? serializeDebt(row) : undefined;
}

export async function addDebt(
	budgetPlanId: string,
	debt: Omit<DebtItem, "id" | "createdAt" | "currentBalance" | "paid" | "paidAmount" | "amount">
): Promise<DebtItem> {
	const installmentMonths = debt.installmentMonths ?? null;
	const monthlyMinimum = debt.monthlyMinimum ?? null;
	let dueAmount = debt.initialBalance;
	if (installmentMonths && installmentMonths > 0) {
		dueAmount = debt.initialBalance / installmentMonths;
	}
	if (monthlyMinimum != null && Number.isFinite(monthlyMinimum)) {
		dueAmount = Math.max(dueAmount, monthlyMinimum);
	}

	const created = await prisma.debt.create({
		data: {
			budgetPlanId,
			name: debt.name,
			type: debt.type as any,
			...(DEBT_HAS_CREDIT_LIMIT ? { creditLimit: (debt as any).creditLimit ?? null } : {}),
			...(DEBT_HAS_DUE_DAY ? { dueDay: (debt as any).dueDay ?? null } : {}),
			...(DEBT_HAS_DUE_DATE ? { dueDate: (debt as any).dueDate ?? null } : {}),
			...(DEBT_HAS_DEFAULT_PAYMENT_SOURCE
				? { defaultPaymentSource: (debt as any).defaultPaymentSource ?? "income" }
				: {}),
			...(DEBT_HAS_DEFAULT_PAYMENT_CARD_DEBT_ID
				? { defaultPaymentCardDebtId: (debt as any).defaultPaymentCardDebtId ?? null }
				: {}),
			initialBalance: debt.initialBalance,
			currentBalance: debt.initialBalance,
			amount: dueAmount,
			paid: false,
			paidAmount: 0,
			monthlyMinimum: debt.monthlyMinimum ?? null,
			interestRate: debt.interestRate ?? null,
			installmentMonths: debt.installmentMonths ?? null,
			sourceType: debt.sourceType ?? null,
			sourceExpenseId: debt.sourceExpenseId ?? null,
			sourceMonthKey: debt.sourceMonthKey ?? null,
			sourceCategoryId: debt.sourceCategoryId ?? null,
			sourceCategoryName: debt.sourceCategoryName ?? null,
			sourceExpenseName: debt.sourceExpenseName ?? null,
		},
		select: {
			id: true,
			name: true,
			type: true,
			...(DEBT_HAS_CREDIT_LIMIT ? { creditLimit: true } : {}),
			...(DEBT_HAS_DUE_DAY ? { dueDay: true } : {}),
			...(DEBT_HAS_DUE_DATE ? { dueDate: true } : {}),
			initialBalance: true,
			currentBalance: true,
			amount: true,
			paid: true,
			paidAmount: true,
			...(DEBT_HAS_DEFAULT_PAYMENT_SOURCE ? { defaultPaymentSource: true } : {}),
			...(DEBT_HAS_DEFAULT_PAYMENT_CARD_DEBT_ID ? { defaultPaymentCardDebtId: true } : {}),
			monthlyMinimum: true,
			interestRate: true,
			installmentMonths: true,
			createdAt: true,
			sourceType: true,
			sourceExpenseId: true,
			sourceMonthKey: true,
			sourceCategoryId: true,
			sourceCategoryName: true,
			sourceExpenseName: true,
		},
	});
	return serializeDebt(created);
}

export async function upsertExpenseDebt(params: {
	budgetPlanId: string;
	expenseId: string;
	monthKey: string;
	year?: number;
	categoryId?: string;
	categoryName?: string;
	expenseName: string;
	remainingAmount: number;
}): Promise<DebtItem | null> {
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

	const existing = await prisma.debt.findFirst({
		where: {
			budgetPlanId,
			sourceType: "expense",
			sourceExpenseId: expenseId,
		},
		select: {
			id: true,
			name: true,
			type: true,
			...(DEBT_HAS_CREDIT_LIMIT ? { creditLimit: true } : {}),
			initialBalance: true,
			currentBalance: true,
			amount: true,
			paid: true,
			paidAmount: true,
			monthlyMinimum: true,
			interestRate: true,
			installmentMonths: true,
			createdAt: true,
			sourceType: true,
			sourceExpenseId: true,
			sourceMonthKey: true,
			sourceCategoryId: true,
			sourceCategoryName: true,
			sourceExpenseName: true,
		},
	});

	if (!Number.isFinite(remainingAmount) || remainingAmount <= 0) {
		if (!existing) return null;
		const updated = await prisma.debt.update({
			where: { id: existing.id },
			data: {
				currentBalance: 0,
				paid: true,
				paidAmount: existing.initialBalance,
			},
			select: {
				id: true,
				name: true,
				type: true,
				...(DEBT_HAS_CREDIT_LIMIT ? { creditLimit: true } : {}),
				initialBalance: true,
				currentBalance: true,
				amount: true,
				paid: true,
				paidAmount: true,
				monthlyMinimum: true,
				interestRate: true,
				installmentMonths: true,
				createdAt: true,
				sourceType: true,
				sourceExpenseId: true,
				sourceMonthKey: true,
				sourceCategoryId: true,
				sourceCategoryName: true,
				sourceExpenseName: true,
			},
		});
		return serializeDebt(updated);
	}

	if (existing) {
		const initialBalance = decimalToNumber(existing.initialBalance);
		const updated = await prisma.debt.update({
			where: { id: existing.id },
			data: {
				currentBalance: remainingAmount,
				paid: false,
				paidAmount: Math.max(0, initialBalance - remainingAmount),
				sourceCategoryId: categoryId ?? undefined,
				sourceCategoryName: categoryName ?? undefined,
				sourceExpenseName: expenseName ?? undefined,
				// include year in the display name so it stays visible
				name: existing.name,
			},
			select: {
				id: true,
				name: true,
				type: true,
				...(DEBT_HAS_CREDIT_LIMIT ? { creditLimit: true } : {}),
				initialBalance: true,
				currentBalance: true,
				amount: true,
				paid: true,
				paidAmount: true,
				monthlyMinimum: true,
				interestRate: true,
				installmentMonths: true,
				createdAt: true,
				sourceType: true,
				sourceExpenseId: true,
				sourceMonthKey: true,
				sourceCategoryId: true,
				sourceCategoryName: true,
				sourceExpenseName: true,
			},
		});
		return serializeDebt(updated);
	}

	const displayCategory = categoryName ? `${categoryName}: ` : "";
	const displayPeriod = year ? ` (${monthKey} ${year})` : ` (${monthKey})`;
	const name = `${displayCategory}${expenseName}${displayPeriod}`;

	const created = await prisma.debt.create({
		data: {
			budgetPlanId,
			name,
			type: "high_purchase",
			initialBalance: remainingAmount,
			currentBalance: remainingAmount,
			amount: remainingAmount,
			paid: false,
			paidAmount: 0,
			sourceType: "expense",
			sourceExpenseId: expenseId,
			sourceMonthKey: monthKey,
			sourceCategoryId: categoryId ?? null,
			sourceCategoryName: categoryName ?? null,
			sourceExpenseName: expenseName,
		},
		select: {
			id: true,
			name: true,
			type: true,
			...(DEBT_HAS_CREDIT_LIMIT ? { creditLimit: true } : {}),
			initialBalance: true,
			currentBalance: true,
			amount: true,
			paid: true,
			paidAmount: true,
			monthlyMinimum: true,
			interestRate: true,
			installmentMonths: true,
			createdAt: true,
			sourceType: true,
			sourceExpenseId: true,
			sourceMonthKey: true,
			sourceCategoryId: true,
			sourceCategoryName: true,
			sourceExpenseName: true,
		},
	});

	return serializeDebt(created);
}

export async function updateDebt(
	budgetPlanId: string,
	id: string,
	updates: Partial<Omit<DebtItem, "id" | "createdAt">>
): Promise<DebtItem | null> {
	const existing = await prisma.debt.findFirst({ where: { id, budgetPlanId }, select: { id: true } });
	if (!existing) return null;
	const updated = await prisma.debt.update({
		where: { id: existing.id },
		data: {
			name: updates.name,
			...(DEBT_HAS_CREDIT_LIMIT
				? {
					creditLimit:
						(updates as any).creditLimit === undefined ? undefined : (updates as any).creditLimit ?? null,
				}
				: {}),
			...(DEBT_HAS_DUE_DAY
				? {
					dueDay: (updates as any).dueDay === undefined ? undefined : (updates as any).dueDay ?? null,
				}
				: {}),
			...(DEBT_HAS_DUE_DATE
				? {
					dueDate: (updates as any).dueDate === undefined ? undefined : (updates as any).dueDate ?? null,
				}
				: {}),
			...(DEBT_HAS_DEFAULT_PAYMENT_SOURCE
				? {
					defaultPaymentSource:
						(updates as any).defaultPaymentSource === undefined
							? undefined
							: (updates as any).defaultPaymentSource ?? "income",
				}
				: {}),
			...(DEBT_HAS_DEFAULT_PAYMENT_CARD_DEBT_ID
				? {
					defaultPaymentCardDebtId:
						(updates as any).defaultPaymentCardDebtId === undefined
							? undefined
							: (updates as any).defaultPaymentCardDebtId ?? null,
				}
				: {}),
			initialBalance: updates.initialBalance,
			currentBalance: updates.currentBalance,
			monthlyMinimum: updates.monthlyMinimum === undefined ? undefined : updates.monthlyMinimum ?? null,
			interestRate: updates.interestRate === undefined ? undefined : updates.interestRate ?? null,
			installmentMonths: updates.installmentMonths === undefined ? undefined : updates.installmentMonths ?? null,
			paid: updates.paid,
			paidAmount: updates.paidAmount,
			amount: updates.amount,
		},
		select: {
			id: true,
			name: true,
			type: true,
			...(DEBT_HAS_CREDIT_LIMIT ? { creditLimit: true } : {}),
			...(DEBT_HAS_DUE_DAY ? { dueDay: true } : {}),
			...(DEBT_HAS_DUE_DATE ? { dueDate: true } : {}),
			initialBalance: true,
			currentBalance: true,
			amount: true,
			paid: true,
			paidAmount: true,
			...(DEBT_HAS_DEFAULT_PAYMENT_SOURCE ? { defaultPaymentSource: true } : {}),
			...(DEBT_HAS_DEFAULT_PAYMENT_CARD_DEBT_ID ? { defaultPaymentCardDebtId: true } : {}),
			monthlyMinimum: true,
			interestRate: true,
			installmentMonths: true,
			createdAt: true,
			sourceType: true,
			sourceExpenseId: true,
			sourceMonthKey: true,
			sourceCategoryId: true,
			sourceCategoryName: true,
			sourceExpenseName: true,
		},
	});
	return serializeDebt(updated);
}

export async function deleteDebt(budgetPlanId: string, id: string): Promise<boolean> {
	const deleted = await prisma.debt.deleteMany({ where: { id, budgetPlanId } });
	return deleted.count > 0;
}

export async function addPayment(
	budgetPlanId: string,
	debtId: string,
	amount: number,
	month: string,
	source: "income" | "extra_funds" | "credit_card" = "income",
	cardDebtId?: string
): Promise<DebtPayment | null> {
	const paidAt = new Date();
	const parsed = parseYearMonthKey(month);
	const year = parsed?.year ?? paidAt.getUTCFullYear();
	const monthNum = parsed?.month ?? paidAt.getUTCMonth() + 1;

	if (source === "credit_card") {
		const trimmedCardId = String(cardDebtId ?? "").trim();
		if (!trimmedCardId) throw new Error("cardDebtId is required when source=credit_card");
		if (trimmedCardId === debtId) throw new Error("Cannot pay a debt using the same card");

		const [targetDebt, cardDebt] = await prisma.$transaction([
			prisma.debt.findFirst({
				where: { id: debtId, budgetPlanId },
				select: { id: true, type: true, currentBalance: true, paidAmount: true },
			}),
			prisma.debt.findFirst({
				where: { id: trimmedCardId, budgetPlanId },
				select: { id: true, type: true, currentBalance: true, paid: true, paidAmount: true },
			}),
		]);
		if (!targetDebt) return null;
		if (!cardDebt) throw new Error("Selected card not found");
		if (cardDebt.type !== "credit_card" && (cardDebt.type as any) !== "store_card") {
			throw new Error("Selected source must be a credit or store card");
		}

		const targetCurrentBalance = decimalToNumber(targetDebt.currentBalance);
		if (targetCurrentBalance <= 0) {
			throw new Error("Debt is already paid");
		}
		const appliedAmount = Math.min(amount, targetCurrentBalance);

		const result = await prisma.$transaction(async (tx) => {
			const createdPayment = await tx.debtPayment.create({
				data: {
					debtId: targetDebt.id,
					amount: appliedAmount,
					paidAt,
					year,
					month: monthNum,
					source: "credit_card" as any,
					...(DEBT_PAYMENT_HAS_CARD_DEBT_ID ? { cardDebtId: trimmedCardId } : {}),
					notes: month ? `month:${month}` : null,
				},
				select: {
					id: true,
					debtId: true,
					amount: true,
					paidAt: true,
					source: true,
					...(DEBT_PAYMENT_HAS_CARD_DEBT_ID ? { cardDebtId: true } : {}),
				},
			});
			const targetCurrentPaid = decimalToNumber(targetDebt.paidAmount);
			const nextTargetBalance = Math.max(0, targetCurrentBalance - appliedAmount);
			const nextTargetPaid = Math.max(0, targetCurrentPaid + appliedAmount);

			await tx.debt.update({
				where: { id: targetDebt.id },
				data: {
					currentBalance: nextTargetBalance,
					paidAmount: nextTargetPaid,
					paid: nextTargetBalance === 0,
				},
			});

			const cardCurrentBalance = decimalToNumber(cardDebt.currentBalance);
			const nextCardBalance = Math.max(0, cardCurrentBalance + appliedAmount);
			await tx.debt.update({
				where: { id: cardDebt.id },
				data: {
					currentBalance: nextCardBalance,
					paid: nextCardBalance === 0,
					// Do not change paidAmount; this is a charge, not a payment.
				},
			});

			return createdPayment;
		});

		return serializePayment(result);
	}

	const debt = await prisma.debt.findFirst({
		where: { id: debtId, budgetPlanId },
		select: { id: true, currentBalance: true, paidAmount: true },
	});
	if (!debt) return null;

	const currentBalance = decimalToNumber(debt.currentBalance);
	if (currentBalance <= 0) {
		throw new Error("Debt is already paid");
	}

	const appliedAmount = Math.min(amount, currentBalance);

	const payment = await prisma.debtPayment.create({
		data: {
			debtId: debt.id,
			amount: appliedAmount,
			paidAt,
			year,
			month: monthNum,
			source: source === "extra_funds" ? "extra_funds" : "income",
			...(DEBT_PAYMENT_HAS_CARD_DEBT_ID ? { cardDebtId: cardDebtId ?? null } : {}),
			notes: month ? `month:${month}` : null,
		},
		select: {
			id: true,
			debtId: true,
			amount: true,
			paidAt: true,
			source: true,
			...(DEBT_PAYMENT_HAS_CARD_DEBT_ID ? { cardDebtId: true } : {}),
		},
	});
	const currentPaid = decimalToNumber(debt.paidAmount);
	const newBalance = Math.max(0, currentBalance - appliedAmount);
	const newPaidAmount = Math.max(0, currentPaid + appliedAmount);
	await prisma.debt.update({
		where: { id: debt.id },
		data: {
			currentBalance: newBalance,
			paidAmount: newPaidAmount,
			paid: newBalance === 0,
		},
	});

	return serializePayment(payment);
}

export async function getPaymentsByDebt(budgetPlanId: string, debtId: string): Promise<DebtPayment[]> {
	const debt = await prisma.debt.findFirst({ where: { id: debtId, budgetPlanId }, select: { id: true } });
	if (!debt) return [];
	const rows = await prisma.debtPayment.findMany({
		where: { debtId: debt.id },
		orderBy: [{ paidAt: "asc" }],
		select: {
			id: true,
			debtId: true,
			amount: true,
			paidAt: true,
			source: true,
			...(DEBT_PAYMENT_HAS_CARD_DEBT_ID ? { cardDebtId: true } : {}),
		},
	});
	return rows.map(serializePayment);
}

export async function getPaymentsByMonth(budgetPlanId: string, month: string, yearOverride?: number): Promise<DebtPayment[]> {
	// MonthKey strings are used throughout the budget summary; map them to (year, month).
	const monthKey = month as MonthKey;
	const year = yearOverride ?? (await resolveBudgetYear(budgetPlanId));
	const monthNum = monthKeyToNumber(monthKey);
	const rows = await prisma.debtPayment.findMany({
		where: {
			debt: { budgetPlanId },
			year,
			month: monthNum,
			source: "income",
		},
		orderBy: [{ paidAt: "asc" }],
		select: {
			id: true,
			debtId: true,
			amount: true,
			paidAt: true,
			source: true,
			...(DEBT_PAYMENT_HAS_CARD_DEBT_ID ? { cardDebtId: true } : {}),
		},
	});
	return rows.map(serializePayment);
}

export async function getTotalDebtBalance(budgetPlanId: string): Promise<number> {
	const rows = await prisma.debt.findMany({ where: { budgetPlanId }, select: { currentBalance: true } });
	return rows.reduce((sum, d) => sum + decimalToNumber(d.currentBalance), 0);
}

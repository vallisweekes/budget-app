"use server";

import "server-only";

import { prisma } from "@/lib/prisma";
import { upsertExpenseDebt } from "@/lib/debts/store";
import { monthNumberToKey } from "@/lib/helpers/monthKey";
import { isNonDebtCategoryName } from "./helpers";
import type { MonthKey } from "@/types";

const OVERDUE_GRACE_DAYS = 5;

function toLocalDateOnly(value: Date): Date {
	return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function resolveExpenseDueDate(params: {
	year: number;
	month: number;
	dueDate: Date | null;
	defaultDueDay: number;
}): Date {
	const { year, month, dueDate, defaultDueDay } = params;
	if (dueDate) return toLocalDateOnly(dueDate);
	return new Date(year, month - 1, defaultDueDay);
}

function addDays(date: Date, days: number): Date {
	const next = new Date(date);
	next.setDate(next.getDate() + days);
	return next;
}

/**
 * Processes unpaid/partially paid expenses and converts them to debts
 * This should be called at the end of each month or when viewing a new month
 * 
 * @param onlyPartialPayments - If true, processes just the requested expense IDs (immediate conversion)
 *                               If false, processes all unpaid/partial from past months
 * @param forceExpenseIds - If set, these expenses are converted immediately (even if not overdue)
 */
export async function processUnpaidExpenses(params: {
	budgetPlanId: string;
	year: number;
	month: number;
	monthKey: MonthKey;
	onlyPartialPayments?: boolean;
	forceExpenseIds?: string[];
}) {
	const { budgetPlanId, year, month, monthKey: _monthKey, onlyPartialPayments = false, forceExpenseIds } = params;

	const now = new Date();
	const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

	// Get budget plan to access default payDate
	const budgetPlan = await prisma.budgetPlan.findUnique({
		where: { id: budgetPlanId },
		select: { payDate: true, kind: true }
	});
	if (budgetPlan && budgetPlan.kind !== "personal") {
		// Holiday/Carnival (and future non-personal plans) should not convert overdue expenses into debts.
		return [];
	}
	const defaultDueDate = budgetPlan?.payDate ?? 27;

	const normalizedForceIds = Array.isArray(forceExpenseIds)
		? forceExpenseIds.map((id) => String(id ?? "").trim()).filter(Boolean)
		: [];

	// Build query based on processing mode
	const whereCondition = onlyPartialPayments
		? {
				// Immediate conversion for a specific set of expenses (even if paidAmount is 0)
				budgetPlanId,
				year,
				month,
				paid: false,
				...(normalizedForceIds.length > 0 ? { id: { in: normalizedForceIds } } : {}),
		  }
		: {
				// All unpaid/partial from past months
				budgetPlanId,
				year,
				month,
				OR: [
					{ paid: false },
					{
						AND: [
							{ paid: false },
							{ paidAmount: { gt: 0 } }
						]
					}
				]
		  };

	// Find all unpaid or partially paid expenses for this month
	type ExpenseCarryRow = {
		id: string;
		name: string;
		amount: any;
		paidAmount: any;
		isAllocation: boolean;
		dueDate: Date | null;
		year: number;
		month: number;
		category: { id: string; name: string } | null;
	};

	const unpaidExpenses = (await prisma.expense.findMany({
		where: whereCondition,
		select: {
			id: true,
			name: true,
			amount: true,
			paidAmount: true,
			isAllocation: true,
			dueDate: true,
			year: true,
			month: true,
			category: {
				select: {
					id: true,
					name: true
				}
			}
		}
	} as any)) as unknown as ExpenseCarryRow[];

	// Convert each unpaid expense to a debt (only if due date has passed or it's a partial payment)
	const results = [];
	for (const expense of unpaidExpenses) {
		if (expense.isAllocation) continue;
		if (isNonDebtCategoryName(expense.category?.name)) continue;
		const totalAmount = Number(expense.amount);
		const paidAmount = Number(expense.paidAmount);
		const remainingAmount = totalAmount - paidAmount;

		// Determine if this expense's due date has passed.
		// If dueDate isn't set, assume default due-day within the expense month.
		const expenseDueDate = resolveExpenseDueDate({
			year: expense.year,
			month: expense.month,
			dueDate: expense.dueDate,
			defaultDueDay: defaultDueDate,
		});
		const overdueThreshold = addDays(expenseDueDate, OVERDUE_GRACE_DAYS);
		const isExpenseOverdueByGrace = overdueThreshold.getTime() <= today.getTime();
		const shouldConvertImmediately = normalizedForceIds.length > 0 || onlyPartialPayments;

		// Skip if not overdue enough (unless forced)
		if (!shouldConvertImmediately && !isExpenseOverdueByGrace) {
			continue;
		}

		if (remainingAmount > 0) {
			const expenseMonthKey = monthNumberToKey(expense.month);
			const debt = await upsertExpenseDebt({
				budgetPlanId,
				expenseId: expense.id,
				monthKey: expenseMonthKey,
				year,
				categoryId: expense.category?.id,
				categoryName: expense.category?.name,
				expenseName: expense.name,
				remainingAmount,
			});
			results.push(debt);
		}
	}

	return results;
}

/**
 * Process all unpaid expenses from past months and convert them to debts
 * This can be called manually or scheduled to run periodically
 */
export async function processPastMonthsUnpaidExpenses(budgetPlanId: string) {
	const plan = await prisma.budgetPlan.findUnique({ where: { id: budgetPlanId }, select: { kind: true } });
	if (plan && plan.kind !== "personal") {
		return;
	}

	const now = new Date();
	const currentYear = now.getFullYear();
	const currentMonth = now.getMonth() + 1;

	// Get all unpaid expenses from past months
	type PastExpenseCarryRow = {
		id: string;
		name: string;
		amount: any;
		paidAmount: any;
		isAllocation: boolean;
		dueDate: Date | null;
		year: number;
		month: number;
		category: { id: string; name: string } | null;
	};

	const pastUnpaidExpenses = (await prisma.expense.findMany({
		where: {
			budgetPlanId,
			AND: [
				// Date filter: past months/years
				{
					OR: [
						// Expenses from previous years
						{ year: { lt: currentYear } },
						// Expenses from previous months this year
						{
							AND: [
								{ year: currentYear },
								{ month: { lt: currentMonth } }
							]
						}
					]
				},
				// Payment status filter: only unpaid or partially paid
				{
					OR: [
						{ paid: false },
						{
							AND: [
								{ paid: false },
								{ paidAmount: { gt: 0 } }
							]
						}
					]
				}
			]
		},
		select: {
			id: true,
			name: true,
			amount: true,
			paidAmount: true,
			isAllocation: true,
			dueDate: true,
			year: true,
			month: true,
			category: {
				select: {
					id: true,
					name: true,
				},
			},
		},
	} as any)) as unknown as PastExpenseCarryRow[];

	// Group by month and process
	const results = [];
	for (const expense of pastUnpaidExpenses) {
		if (expense.isAllocation) continue;
		if (isNonDebtCategoryName(expense.category?.name)) continue;
		const monthKey = monthNumberToKey(expense.month);
		const totalAmount = Number(expense.amount);
		const paidAmount = Number(expense.paidAmount);
		const remainingAmount = totalAmount - paidAmount;

		if (remainingAmount > 0) {
			const debt = await upsertExpenseDebt({
				budgetPlanId,
				expenseId: expense.id,
				monthKey,
				year: expense.year,
				categoryId: expense.category?.id,
				categoryName: expense.category?.name,
				expenseName: expense.name,
				remainingAmount,
			});
			results.push(debt);
		}
	}

	return results;
}

/**
 * Converts any unpaid/part-paid expenses into debts when:
 * - the due date is overdue by >= OVERDUE_GRACE_DAYS, OR
 * - there's any paidAmount recorded (partial payment)
 *
 * This is intended to be called when loading the Debts page.
 */
export async function processOverdueExpensesToDebts(budgetPlanId: string) {
	const now = new Date();
	const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

	const budgetPlan = await prisma.budgetPlan.findUnique({
		where: { id: budgetPlanId },
		select: { payDate: true },
	});
	const defaultDueDate = budgetPlan?.payDate ?? 27;

	type OverdueExpenseCarryRow = {
		id: string;
		name: string;
		amount: any;
		paidAmount: any;
		isAllocation: boolean;
		dueDate: Date | null;
		year: number;
		month: number;
		category: { id: string; name: string } | null;
	};

	const unpaidExpenses = (await prisma.expense.findMany({
		where: {
			budgetPlanId,
			paid: false,
		},
		select: {
			id: true,
			name: true,
			amount: true,
			paidAmount: true,
			isAllocation: true,
			dueDate: true,
			year: true,
			month: true,
			category: {
				select: {
					id: true,
					name: true,
				},
			},
		},
	} as any)) as unknown as OverdueExpenseCarryRow[];

	const results = [];
	for (const expense of unpaidExpenses) {
		if (expense.isAllocation) continue;
		if (isNonDebtCategoryName(expense.category?.name)) continue;
		const totalAmount = Number(expense.amount);
		const paidAmount = Number(expense.paidAmount);
		const remainingAmount = totalAmount - paidAmount;
		if (!(Number.isFinite(remainingAmount) && remainingAmount > 0)) continue;

		const expenseDueDate = resolveExpenseDueDate({
			year: expense.year,
			month: expense.month,
			dueDate: expense.dueDate,
			defaultDueDay: defaultDueDate,
		});
		const overdueThreshold = addDays(expenseDueDate, OVERDUE_GRACE_DAYS);
		const isExpenseOverdueByGrace = overdueThreshold.getTime() <= today.getTime();
		const hasPartialPayment = Number.isFinite(paidAmount) && paidAmount > 0;

		if (!isExpenseOverdueByGrace && !hasPartialPayment) continue;

		const monthKey = monthNumberToKey(expense.month);
		const debt = await upsertExpenseDebt({
			budgetPlanId,
			expenseId: expense.id,
			monthKey,
			year: expense.year,
			categoryId: expense.category?.id,
			categoryName: expense.category?.name,
			expenseName: expense.name,
			remainingAmount,
		});
		results.push(debt);
	}

	return results;
}

/**
 * Gets all expense-derived debts for display
 * Only shows debts from expenses where:
 * 1. The due date has passed
 * 2. OR it has a partial payment (paidAmount > 0)
 */
export async function getExpenseDebts(budgetPlanId: string) {
	const budgetPlan = await prisma.budgetPlan.findUnique({
		where: { id: budgetPlanId },
		select: { payDate: true },
	});
	const defaultDueDay = budgetPlan?.payDate ?? 27;

	// First, clean up any stale paid/zero-balance debts
	await prisma.debt.deleteMany({
		where: {
			budgetPlanId,
			sourceType: "expense",
			OR: [
				{ currentBalance: { lte: 0 } },
				{ paid: true },
			],
		},
	});

	const debts = await prisma.debt.findMany({
		where: {
			budgetPlanId,
			sourceType: "expense",
			currentBalance: { gt: 0 }
		},
		orderBy: {
			createdAt: "desc"
		}
	});

	// Expense-backed debts are derived state.
	// Only show them when the *source expense* is overdue by grace days OR has a partial payment.
	// This prevents future-due items (e.g. a Jan-listed bill due Feb 24) from appearing as "missed".
	const sourceExpenseIds = Array.from(
		new Set(debts.map((d) => String(d.sourceExpenseId ?? "").trim()).filter(Boolean))
	);

	type ExpenseDebtVisibilityRow = {
		id: string;
		amount: any;
		paidAmount: any;
		paid: boolean;
		isAllocation: boolean;
		dueDate: Date | null;
		year: number;
		month: number;
		category: { name: string } | null;
	};

	const expenses = sourceExpenseIds.length
		? (((await prisma.expense.findMany({
				where: { budgetPlanId, id: { in: sourceExpenseIds } },
				select: {
					id: true,
					amount: true,
					paidAmount: true,
					paid: true,
					isAllocation: true,
					dueDate: true,
					year: true,
					month: true,
					category: { select: { name: true } },
				},
			} as any)) as unknown) as ExpenseDebtVisibilityRow[])
		: [];

	const expenseById = new Map(expenses.map((e) => [e.id, e] as const));
	const now = new Date();
	const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
	const debtsToDelete: string[] = [];
	const visibleDebts = debts.filter((d) => {
		const expenseId = String(d.sourceExpenseId ?? "").trim();
		if (!expenseId) return true;
		const expense = expenseById.get(expenseId);
		if (!expense) return true;
		if (expense.isAllocation) {
			debtsToDelete.push(d.id);
			return false;
		}
		if (isNonDebtCategoryName(expense.category?.name)) {
			debtsToDelete.push(d.id);
			return false;
		}
		if (expense.paid) {
			debtsToDelete.push(d.id);
			return false;
		}
		const totalAmount = Number(expense.amount);
		const paidAmount = Number(expense.paidAmount);
		const remainingAmount = totalAmount - paidAmount;
		if (!(Number.isFinite(remainingAmount) && remainingAmount > 0)) {
			debtsToDelete.push(d.id);
			return false;
		}

		const expenseDueDate = resolveExpenseDueDate({
			year: expense.year,
			month: expense.month,
			dueDate: expense.dueDate,
			defaultDueDay,
		});
		const overdueThreshold = addDays(expenseDueDate, OVERDUE_GRACE_DAYS);
		const isExpenseOverdueByGrace = overdueThreshold.getTime() <= today.getTime();
		const hasPartialPayment = Number.isFinite(paidAmount) && paidAmount > 0;
		if (!isExpenseOverdueByGrace && !hasPartialPayment) {
			debtsToDelete.push(d.id);
			return false;
		}
		return true;
	});

	if (debtsToDelete.length > 0) {
		await prisma.debt.deleteMany({
			where: { budgetPlanId, id: { in: debtsToDelete } },
		});
	}

	// Filter out allocations and non-debt categories
	const filtered = visibleDebts.filter(d => {
		const catName = d.sourceCategoryName;
		if (isNonDebtCategoryName(catName)) return false;
		return true;
	});

	return filtered.map(d => ({
		id: d.id,
		name: d.name,
		type: d.type,
		initialBalance: Number(d.initialBalance),
		currentBalance: Number(d.currentBalance),
		amount: Number(d.amount),
		paid: d.paid,
		paidAmount: Number(d.paidAmount),
		monthlyMinimum: d.monthlyMinimum ? Number(d.monthlyMinimum) : undefined,
		interestRate: d.interestRate ? Number(d.interestRate) : undefined,
		installmentMonths: d.installmentMonths ?? undefined,
		createdAt: d.createdAt.toISOString(),
		sourceType: "expense" as const,
		sourceExpenseId: d.sourceExpenseId ?? undefined,
		sourceMonthKey: d.sourceMonthKey ?? undefined,
		sourceCategoryId: d.sourceCategoryId ?? undefined,
		sourceCategoryName: d.sourceCategoryName ?? undefined,
		sourceExpenseName: d.sourceExpenseName ?? undefined,
	}));
}

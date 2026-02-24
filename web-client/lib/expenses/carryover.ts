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
	type DebtItem = import("@/types/helpers/debts").DebtItem;
	const budgetPlan = await prisma.budgetPlan.findUnique({
		where: { id: budgetPlanId },
		select: { payDate: true },
	});
	const defaultDueDay = budgetPlan?.payDate ?? 27;

	// Keep paid expense-derived debts so they can appear in Paid History.

	function isDebtTypeEnumMismatchError(error: unknown): boolean {
		const message = String((error as any)?.message ?? error);
		return message.includes("not found in enum 'DebtType'") || message.includes("not found in enum \"DebtType\"");
	}

	type ExpenseDebtRow = {
		id: string;
		name: string;
		type: string;
		initialBalance: any;
		currentBalance: any;
		amount: any;
		paid: boolean;
		paidAmount: any;
		monthlyMinimum: any | null;
		interestRate: any | null;
		installmentMonths: number | null;
		createdAt: Date | string;
		sourceExpenseId: string | null;
		sourceMonthKey: string | null;
		sourceCategoryId: string | null;
		sourceCategoryName: string | null;
		sourceExpenseName: string | null;
	};

	let debts: ExpenseDebtRow[];
	try {
		debts = (await prisma.debt.findMany({
			where: {
				budgetPlanId,
				sourceType: "expense",
			},
			orderBy: {
				createdAt: "desc",
			},
			select: {
				id: true,
				name: true,
				type: true,
				initialBalance: true,
				currentBalance: true,
				amount: true,
				paid: true,
				paidAmount: true,
				monthlyMinimum: true,
				interestRate: true,
				installmentMonths: true,
				createdAt: true,
				sourceExpenseId: true,
				sourceMonthKey: true,
				sourceCategoryId: true,
				sourceCategoryName: true,
				sourceExpenseName: true,
			},
		})) as unknown as ExpenseDebtRow[];
	} catch (error) {
		if (!isDebtTypeEnumMismatchError(error)) throw error;
		debts = await prisma.$queryRaw<ExpenseDebtRow[]>`
			SELECT
				"id",
				"name",
				"type"::text AS "type",
				"initialBalance",
				"currentBalance",
				"amount",
				"paid",
				"paidAmount",
				"monthlyMinimum",
				"interestRate",
				"installmentMonths",
				"createdAt",
				"sourceExpenseId",
				"sourceMonthKey",
				"sourceCategoryId",
				"sourceCategoryName",
				"sourceExpenseName"
			FROM "Debt"
			WHERE "budgetPlanId" = ${budgetPlanId}
				AND "sourceType" = 'expense'
			ORDER BY "createdAt" DESC
		`;
	}

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
	const expenseUpdates: Array<{ id: string; paidAmount: number; paid: boolean }> = [];
	const visibleDebts = debts.filter((d) => {
		const expenseId = String(d.sourceExpenseId ?? "").trim();
		if (!expenseId) return true;
		const expense = expenseById.get(expenseId);
		if (!expense) return true;
		if (expense.isAllocation) {
			return false;
		}
		if (isNonDebtCategoryName(expense.category?.name)) {
			return false;
		}
		if (expense.paid) {
			return true;
		}
		const totalAmount = Number(expense.amount);
		let paidAmount = Number(expense.paidAmount);
		const debtPaidAmount = Number(d.paidAmount);

		// Reconcile historical debt-payments into the source expense.
		// This keeps expense-derived debt state consistent even for records paid
		// before debt-payment -> expense sync was introduced.
		if (Number.isFinite(debtPaidAmount) && debtPaidAmount > paidAmount) {
			const reconciledPaidAmount = Math.min(totalAmount, debtPaidAmount);
			if (reconciledPaidAmount > paidAmount) {
				expenseUpdates.push({
					id: expense.id,
					paidAmount: reconciledPaidAmount,
					paid: totalAmount > 0 && reconciledPaidAmount >= totalAmount,
				});
				paidAmount = reconciledPaidAmount;
			}
		}

		const remainingAmount = totalAmount - paidAmount;
		if (!(Number.isFinite(remainingAmount) && remainingAmount > 0)) {
			return true;
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
			return false;
		}
		return true;
	});

	if (expenseUpdates.length > 0) {
		await Promise.all(
			expenseUpdates.map((u) =>
				prisma.expense.update({
					where: { id: u.id },
					data: { paidAmount: u.paidAmount, paid: u.paid },
				})
			)
		);
	}

	// Filter out allocations and non-debt categories
	const filtered = visibleDebts.filter(d => {
		const catName = d.sourceCategoryName;
		if (isNonDebtCategoryName(catName)) return false;
		return true;
	});

	type LatePaidExpenseRow = {
		id: string;
		name: string;
		amount: any;
		paidAmount: any;
		paid: boolean;
		isAllocation: boolean;
		dueDate: Date | null;
		year: number;
		month: number;
		updatedAt: Date;
		category: { id: string; name: string } | null;
	};

	const paidExpensesWithoutDebt = ((await prisma.expense.findMany({
		where: {
			budgetPlanId,
			paid: true,
			paidAmount: { gt: 0 },
			isAllocation: false,
			dueDate: { not: null },
			...(sourceExpenseIds.length > 0 ? { id: { notIn: sourceExpenseIds } } : {}),
		},
		select: {
			id: true,
			name: true,
			amount: true,
			paidAmount: true,
			paid: true,
			isAllocation: true,
			dueDate: true,
			year: true,
			month: true,
			updatedAt: true,
			category: { select: { id: true, name: true } },
		},
	} as any)) as unknown) as LatePaidExpenseRow[];

	const paidExpenseIds = paidExpensesWithoutDebt.map((e) => e.id);
	const latestExpensePayments = paidExpenseIds.length
		? await prisma.expensePayment.groupBy({
				by: ["expenseId"],
				where: { expenseId: { in: paidExpenseIds } },
				_max: { paidAt: true },
		  })
		: [];
	const latestExpensePaymentByExpenseId = new Map(
		latestExpensePayments.map((row) => [row.expenseId, row._max.paidAt ?? null] as const)
	);

	const syntheticPaidCarryovers: DebtItem[] = paidExpensesWithoutDebt
		.filter((expense) => {
			if (isNonDebtCategoryName(expense.category?.name)) return false;
			const totalAmount = Number(expense.amount);
			const paidAmount = Number(expense.paidAmount);
			const remainingAmount = totalAmount - paidAmount;
			if (!(Number.isFinite(remainingAmount) && remainingAmount <= 0)) return false;

			const dueDate = resolveExpenseDueDate({
				year: expense.year,
				month: expense.month,
				dueDate: expense.dueDate,
				defaultDueDay,
			});
			const overdueThreshold = addDays(dueDate, OVERDUE_GRACE_DAYS);
			const explicitPaidAt = latestExpensePaymentByExpenseId.get(expense.id) ?? null;
			const fallbackPaidAt = explicitPaidAt ? null : expense.updatedAt;
			const latestPaymentAt = explicitPaidAt ?? fallbackPaidAt;
			if (!latestPaymentAt) return false;

			const isLate = latestPaymentAt.getTime() > overdueThreshold.getTime();
			if (!isLate) return false;

			// If we don't have explicit payment rows, keep this fallback strict to avoid
			// pulling ordinary paid expenses into Debt History.
			if (!explicitPaidAt) {
				const fallbackWindowMs = 14 * 24 * 60 * 60 * 1000;
				if (latestPaymentAt.getTime() - overdueThreshold.getTime() > fallbackWindowMs) {
					return false;
				}
			}

			return true;
		})
		.map((expense) => {
			const totalAmount = Number(expense.amount);
			const normalizedAmount = Number.isFinite(totalAmount) ? Math.max(0, totalAmount) : 0;
			const monthKey = monthNumberToKey(expense.month);
			return {
				id: `expense-history-${expense.id}`,
				name: expense.name,
				type: "other" as DebtItem["type"],
				initialBalance: normalizedAmount,
				currentBalance: 0,
				amount: normalizedAmount,
				paid: true,
				paidAmount: normalizedAmount,
				createdAt: new Date(expense.year, expense.month - 1, 1).toISOString(),
				sourceType: "expense" as const,
				sourceExpenseId: expense.id,
				sourceMonthKey: monthKey,
				sourceCategoryId: expense.category?.id,
				sourceCategoryName: expense.category?.name,
				sourceExpenseName: expense.name,
			};
		});

	const mappedDebts = filtered.map(d => {
		const createdAt = d.createdAt instanceof Date ? d.createdAt : new Date(d.createdAt);
		const expenseId = String(d.sourceExpenseId ?? "").trim();
		const expense = expenseId ? expenseById.get(expenseId) : undefined;
		const initialBalance = Number(d.initialBalance);
		const computedInitial = Number.isFinite(initialBalance) && initialBalance > 0
			? initialBalance
			: Number(expense?.amount ?? d.amount);
		const sourcePaidAmount = Number(expense?.paidAmount ?? d.paidAmount);
		const paidAmount = Math.min(computedInitial, Math.max(0, sourcePaidAmount));
		const currentBalance = Math.max(0, computedInitial - paidAmount);
		const paid = Boolean(expense?.paid ?? d.paid) || currentBalance <= 0;
		return {
		id: d.id,
		name: d.name,
		type: d.type as DebtItem["type"],
		initialBalance: computedInitial,
		currentBalance,
		amount: Number(d.amount),
		paid,
		paidAmount,
		monthlyMinimum: d.monthlyMinimum ? Number(d.monthlyMinimum) : undefined,
		interestRate: d.interestRate ? Number(d.interestRate) : undefined,
		installmentMonths: d.installmentMonths ?? undefined,
		createdAt: createdAt.toISOString(),
		sourceType: "expense" as const,
		sourceExpenseId: d.sourceExpenseId ?? undefined,
		sourceMonthKey: d.sourceMonthKey ?? undefined,
		sourceCategoryId: d.sourceCategoryId ?? undefined,
		sourceCategoryName: d.sourceCategoryName ?? undefined,
		sourceExpenseName: d.sourceExpenseName ?? undefined,
		};
	});

	return [...mappedDebts, ...syntheticPaidCarryovers];
}

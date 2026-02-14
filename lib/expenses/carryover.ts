"use server";

import { prisma } from "@/lib/prisma";
import { upsertExpenseDebt } from "@/lib/debts/store";
import type { MonthKey } from "@/types";

/**
 * Processes unpaid/partially paid expenses and converts them to debts
 * This should be called at the end of each month or when viewing a new month
 * 
 * @param onlyPartialPayments - If true, only process expenses with partial payments (immediate conversion)
 *                               If false, only process expenses from past months
 */
export async function processUnpaidExpenses(params: {
	budgetPlanId: string;
	year: number;
	month: number;
	monthKey: MonthKey;
	onlyPartialPayments?: boolean;
}) {
	const { budgetPlanId, year, month, monthKey, onlyPartialPayments = false } = params;

	const now = new Date();
	const currentDate = now.getDate(); // Current day of month
	const currentYear = now.getFullYear();
	const currentMonth = now.getMonth() + 1; // JS months are 0-indexed

	// Get budget plan to access default payDate
	const budgetPlan = await prisma.budgetPlan.findUnique({
		where: { id: budgetPlanId },
		select: { payDate: true }
	});
	const defaultDueDate = budgetPlan?.payDate ?? 27;

	// Build query based on processing mode
	const whereCondition = onlyPartialPayments
		? {
				// Only partial payments (immediate conversion)
				budgetPlanId,
				year,
				month,
				paid: false,
				paidAmount: { gt: 0 },
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
	const unpaidExpenses = await prisma.expense.findMany({
		where: whereCondition,
		select: {
			id: true,
			name: true,
			amount: true,
			paidAmount: true,
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
	});

	// Convert each unpaid expense to a debt (only if due date has passed or it's a partial payment)
	const results = [];
	for (const expense of unpaidExpenses) {
		const totalAmount = Number(expense.amount);
		const paidAmount = Number(expense.paidAmount);
		const remainingAmount = totalAmount - paidAmount;

		// Determine if this expense's due date has passed
		const expenseDueDate = expense.dueDate ?? defaultDueDate;
		const isExpenseOverdue = 
			// Past months are always overdue
			(expense.year < currentYear) ||
			(expense.year === currentYear && expense.month < currentMonth) ||
			// Current month: check if due date has passed
			(expense.year === currentYear && expense.month === currentMonth && expenseDueDate < currentDate);

		// Skip if not overdue (unless we're only processing partial payments)
		if (!onlyPartialPayments && !isExpenseOverdue) {
			continue;
		}

		if (remainingAmount > 0) {
			const debt = await upsertExpenseDebt({
				budgetPlanId,
				expenseId: expense.id,
				monthKey,
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
	const now = new Date();
	const currentYear = now.getFullYear();
	const currentMonth = now.getMonth() + 1;

	// Get all unpaid expenses from past months
	const pastUnpaidExpenses = await prisma.expense.findMany({
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
		include: {
			category: {
				select: {
					id: true,
					name: true
				}
			}
		}
	});

	// Group by month and process
	const results = [];
	for (const expense of pastUnpaidExpenses) {
		const monthKey = `${expense.year}-${String(expense.month).padStart(2, '0')}` as MonthKey;
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
 * Gets all expense-derived debts for display
 * Only shows debts from expenses where:
 * 1. The due date has passed
 * 2. OR it has a partial payment (paidAmount > 0)
 */
export async function getExpenseDebts(budgetPlanId: string) {
	const now = new Date();
	const currentYear = now.getFullYear();
	const currentMonth = now.getMonth() + 1;
	const currentDate = now.getDate();

	// Get budget plan to access default payDate
	const budgetPlan = await prisma.budgetPlan.findUnique({
		where: { id: budgetPlanId },
		select: { payDate: true }
	});
	const defaultDueDate = budgetPlan?.payDate ?? 27;

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

	// Fetch the source expenses to check due dates
	const expenseIds = debts.map(d => d.sourceExpenseId).filter(Boolean) as string[];
	const expenses = await prisma.expense.findMany({
		where: {
			id: { in: expenseIds }
		},
		select: {
			id: true,
			year: true,
			month: true,
			dueDate: true,
			paidAmount: true
		}
	});

	const expenseMap = new Map(expenses.map(e => [e.id, e]));

	// Filter to only show debts where due date has passed or has partial payment
	const filteredDebts = debts.filter(d => {
		// Keep if it's a partial payment (paidAmount > 0 on the debt)
		const debtPaidAmount = Number(d.paidAmount);
		if (debtPaidAmount > 0) return true;

		// Get the source expense
		const expense = d.sourceExpenseId ? expenseMap.get(d.sourceExpenseId) : null;
		if (!expense) {
			// If we can't find the expense, parse sourceMonthKey as fallback
			if (d.sourceMonthKey) {
				const [yearStr, monthStr] = d.sourceMonthKey.split('-');
				const debtYear = parseInt(yearStr);
				const debtMonth = parseInt(monthStr);
				
				// Use default due date for fallback
				const isOverdue = 
					(debtYear < currentYear) ||
					(debtYear === currentYear && debtMonth < currentMonth) ||
					(debtYear === currentYear && debtMonth === currentMonth && defaultDueDate < currentDate);
				
				return isOverdue;
			}
			return true; // Keep if we can't determine
		}

		// Check if expense due date has passed
		const expenseDueDate = expense.dueDate ?? defaultDueDate;
		const expensePaidAmount = Number(expense.paidAmount);
		
		// Keep if partial payment on expense
		if (expensePaidAmount > 0) return true;

		// Check if overdue
		const isOverdue = 
			(expense.year < currentYear) ||
			(expense.year === currentYear && expense.month < currentMonth) ||
			(expense.year === currentYear && expense.month === currentMonth && expenseDueDate < currentDate);

		return isOverdue;
	});

	return filteredDebts.map(d => ({
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
		createdAt: d.createdAt.toISOString(),
		sourceType: "expense" as const,
		sourceExpenseId: d.sourceExpenseId ?? undefined,
		sourceMonthKey: d.sourceMonthKey ?? undefined,
		sourceCategoryId: d.sourceCategoryId ?? undefined,
		sourceCategoryName: d.sourceCategoryName ?? undefined,
		sourceExpenseName: d.sourceExpenseName ?? undefined,
	}));
}

import { prisma } from "@/lib/prisma";
import { upsertExpenseDebt } from "@/lib/debts/store";
import type { MonthKey } from "@/types";
import { isNonDebtCategoryName } from "../helpers";
import { OVERDUE_GRACE_DAYS, resolveExpenseDueDate, addDays, monthNumberToKey } from "./shared";

type ExpenseCarryRow = {
	id: string;
	name: string;
	amount: number | string | null;
	paidAmount: number | string | null;
	isAllocation: boolean;
	dueDate: Date | null;
	year: number;
	month: number;
	category: { id: string; name: string } | null;
};

export async function processUnpaidExpenses(params: {
	budgetPlanId: string;
	year: number;
	month: number;
	monthKey: MonthKey;
	onlyPartialPayments?: boolean;
	forceExpenseIds?: string[];
}) {
	const { budgetPlanId, year, month, onlyPartialPayments = false, forceExpenseIds } = params;
	const now = new Date();
	const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

	const budgetPlan = await prisma.budgetPlan.findUnique({
		where: { id: budgetPlanId },
		select: { payDate: true, kind: true },
	});
	if (budgetPlan && budgetPlan.kind !== "personal") return [];
	const defaultDueDate = budgetPlan?.payDate ?? 27;

	const normalizedForceIds = Array.isArray(forceExpenseIds)
		? forceExpenseIds.map((id) => String(id ?? "").trim()).filter(Boolean)
		: [];

	const whereCondition = onlyPartialPayments
		? {
				budgetPlanId,
				year,
				month,
				paid: false,
				...(normalizedForceIds.length > 0 ? { id: { in: normalizedForceIds } } : {}),
		  }
		: {
				budgetPlanId,
				year,
				month,
				OR: [{ paid: false }, { AND: [{ paid: false }, { paidAmount: { gt: 0 } }] }],
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
			category: { select: { id: true, name: true } },
		},
	})) as unknown as ExpenseCarryRow[];

	const results = [];
	for (const expense of unpaidExpenses) {
		if (expense.isAllocation) continue;
		if (isNonDebtCategoryName(expense.category?.name)) continue;

		const totalAmount = Number(expense.amount);
		const paidAmount = Number(expense.paidAmount);
		const remainingAmount = totalAmount - paidAmount;

		const expenseDueDate = resolveExpenseDueDate({
			year: expense.year,
			month: expense.month,
			dueDate: expense.dueDate,
			defaultDueDay: defaultDueDate,
		});
		const overdueThreshold = addDays(expenseDueDate, OVERDUE_GRACE_DAYS);
		const isExpenseOverdueByGrace = overdueThreshold.getTime() <= today.getTime();
		const shouldConvertImmediately = normalizedForceIds.length > 0 || onlyPartialPayments;
		if (!shouldConvertImmediately && !isExpenseOverdueByGrace) continue;

		if (remainingAmount > 0) {
			const debt = await upsertExpenseDebt({
				budgetPlanId,
				expenseId: expense.id,
				monthKey: monthNumberToKey(expense.month),
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

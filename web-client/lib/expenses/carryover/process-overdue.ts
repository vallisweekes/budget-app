import { prisma } from "@/lib/prisma";
import { upsertExpenseDebt } from "@/lib/debts/store";
import { isNonDebtCategoryName } from "../helpers";
import { OVERDUE_GRACE_DAYS, resolveExpenseDueDate, addDays, monthNumberToKey } from "./shared";

type OverdueExpenseCarryRow = {
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

export async function processOverdueExpensesToDebts(budgetPlanId: string) {
	const now = new Date();
	const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

	const budgetPlan = await prisma.budgetPlan.findUnique({
		where: { id: budgetPlanId },
		select: { payDate: true },
	});
	const defaultDueDate = budgetPlan?.payDate ?? 27;

	const unpaidExpenses = (await prisma.expense.findMany({
		where: { budgetPlanId, paid: false },
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
	})) as unknown as OverdueExpenseCarryRow[];

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

		const debt = await upsertExpenseDebt({
			budgetPlanId,
			expenseId: expense.id,
			monthKey: monthNumberToKey(expense.month),
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

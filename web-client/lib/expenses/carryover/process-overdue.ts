import { prisma } from "@/lib/prisma";
import { upsertExpenseDebt } from "@/lib/debts/store";
import { isExpenseDebtCoveredByRegularDebt } from "@/lib/helpers/debts/expenseDebtDuplicates";
import { isLegacyPlaceholderExpenseRow } from "@/lib/expenses/legacyPlaceholders";
import { getExpensePaidMap } from "@/lib/expenses/paidSummary";
import { isNonDebtCategoryName } from "../helpers";
import { markExpensesMovedToDebt } from "./get-expense-debts.helpers";
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
	const currentYear = today.getFullYear();
	const currentMonth = today.getMonth() + 1;

	const budgetPlan = await prisma.budgetPlan.findUnique({
		where: { id: budgetPlanId },
		select: { payDate: true },
	});
	const defaultDueDate = budgetPlan?.payDate ?? 27;

	const unpaidExpenses = (await prisma.expense.findMany({
		where: {
			budgetPlanId,
			isAllocation: false,
			isMovedToDebt: false,
			OR: [
				{ year: { lt: currentYear } },
				{ year: currentYear, month: { lte: currentMonth } },
			],
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
			category: { select: { id: true, name: true } },
		},
	})) as unknown as OverdueExpenseCarryRow[];

	const paidMap = await getExpensePaidMap(
		unpaidExpenses.map((expense) => ({
			id: expense.id,
			amount: Number(expense.amount ?? 0),
		})),
	);

	const regularDebts = await prisma.debt.findMany({
		where: { budgetPlanId, sourceType: null, paid: false },
		select: { name: true, sourceType: true, currentBalance: true, paid: true },
	});

	const results = [];
	for (const expense of unpaidExpenses) {
		if (expense.isAllocation) continue;
		if (isNonDebtCategoryName(expense.category?.name)) continue;
		if (isLegacyPlaceholderExpenseRow({ name: expense.name, isAllocation: expense.isAllocation })) continue;
		if (isExpenseDebtCoveredByRegularDebt({
			expenseName: expense.name,
			sourceCategoryName: expense.category?.name,
			regularDebts,
		})) continue;

		const totalAmount = Number(expense.amount);
		const paidInfo = paidMap.get(expense.id);
		const paidAmount = paidInfo?.paidAmount ?? Number(expense.paidAmount);
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
		if (!isExpenseOverdueByGrace) continue;

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

		// If this debt was created because the expense is overdue (auto-transfer),
		// hide the original expense from monthly expense lists/totals.
		if (isExpenseOverdueByGrace) {
			await markExpensesMovedToDebt([expense.id]);
		}
		results.push(debt);
	}

	return results;
}

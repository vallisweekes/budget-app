import { prisma } from "@/lib/prisma";
import { upsertExpenseDebt } from "@/lib/debts/store";
import { isNonDebtCategoryName } from "../helpers";
import { monthNumberToKey } from "./shared";

type PastExpenseCarryRow = {
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

export async function processPastMonthsUnpaidExpenses(budgetPlanId: string) {
	const plan = await prisma.budgetPlan.findUnique({ where: { id: budgetPlanId }, select: { kind: true } });
	if (plan && plan.kind !== "personal") return;

	const now = new Date();
	const currentYear = now.getFullYear();
	const currentMonth = now.getMonth() + 1;

	const pastUnpaidExpenses = (await prisma.expense.findMany({
		where: {
			budgetPlanId,
			AND: [
				{
					OR: [
						{ year: { lt: currentYear } },
						{ AND: [{ year: currentYear }, { month: { lt: currentMonth } }] },
					],
				},
				{
					OR: [{ paid: false }, { AND: [{ paid: false }, { paidAmount: { gt: 0 } }] }],
				},
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
	})) as unknown as PastExpenseCarryRow[];

	const results = [];
	for (const expense of pastUnpaidExpenses) {
		if (expense.isAllocation) continue;
		if (isNonDebtCategoryName(expense.category?.name)) continue;

		const totalAmount = Number(expense.amount);
		const paidAmount = Number(expense.paidAmount);
		const remainingAmount = totalAmount - paidAmount;
		if (remainingAmount <= 0) continue;

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

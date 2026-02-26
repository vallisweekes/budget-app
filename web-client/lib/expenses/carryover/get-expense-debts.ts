import { prisma } from "@/lib/prisma";
import { isNonDebtCategoryName } from "../helpers";
import { OVERDUE_GRACE_DAYS, resolveExpenseDueDate, addDays, monthNumberToKey } from "./shared";
import { syncExpensePaymentsToPaidAmount } from "@/lib/expenses/paymentSync";
import {
	fetchExpenseDebtRows,
	fetchLinkedExpenses,
	fetchPaidExpensesWithoutDebt,
	type ExpenseDebtRow,
	type ExpenseDebtVisibilityRow,
} from "./get-expense-debts.helpers";

type DebtItem = import("@/types/helpers/debts").DebtItem;

export async function getExpenseDebts(budgetPlanId: string) {
	const budgetPlan = await prisma.budgetPlan.findUnique({ where: { id: budgetPlanId }, select: { payDate: true } });
	const defaultDueDay = budgetPlan?.payDate ?? 27;
	const debts = await fetchExpenseDebtRows(budgetPlanId);

	const sourceExpenseIds = Array.from(new Set(debts.map((d) => String(d.sourceExpenseId ?? "").trim()).filter(Boolean)));
	const expenses = await fetchLinkedExpenses(budgetPlanId, sourceExpenseIds);
	const expenseById = new Map(expenses.map((e) => [e.id, e] as const));
	const now = new Date();
	const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
	const expenseUpdates: Array<{ id: string; amount: number; paidAmount: number; paid: boolean }> = [];

	const visibleDebts = debts.filter((d) => {
		const expenseId = String(d.sourceExpenseId ?? "").trim();
		if (!expenseId) return true;
		const expense = expenseById.get(expenseId);
		if (!expense) return true;
		if (expense.isAllocation || isNonDebtCategoryName(expense.category?.name)) return false;
		if (expense.paid) return true;

		const totalAmount = Number(expense.amount);
		let paidAmount = Number(expense.paidAmount);
		const debtPaidAmount = Number(d.paidAmount);
		if (Number.isFinite(debtPaidAmount) && debtPaidAmount > paidAmount) {
			const reconciledPaidAmount = Math.min(totalAmount, debtPaidAmount);
			if (reconciledPaidAmount > paidAmount) {
				expenseUpdates.push({
					id: expense.id,
					amount: totalAmount,
					paidAmount: reconciledPaidAmount,
					paid: totalAmount > 0 && reconciledPaidAmount >= totalAmount,
				});
				paidAmount = reconciledPaidAmount;
			}
		}

		const remainingAmount = totalAmount - paidAmount;
		if (!(Number.isFinite(remainingAmount) && remainingAmount > 0)) return true;
		const expenseDueDate = resolveExpenseDueDate({ year: expense.year, month: expense.month, dueDate: expense.dueDate, defaultDueDay });
		const overdueThreshold = addDays(expenseDueDate, OVERDUE_GRACE_DAYS);
		const isExpenseOverdueByGrace = overdueThreshold.getTime() <= today.getTime();
		const hasPartialPayment = Number.isFinite(paidAmount) && paidAmount > 0;
		return isExpenseOverdueByGrace || hasPartialPayment;
	});

	if (expenseUpdates.length > 0) {
		await Promise.all(
			expenseUpdates.map(async (u) => {
				await prisma.expense.update({
					where: { id: u.id },
					data: { paidAmount: u.paidAmount, paid: u.paid },
				});

				await syncExpensePaymentsToPaidAmount({
					expenseId: u.id,
					budgetPlanId,
					amount: u.amount,
					desiredPaidAmount: u.paidAmount,
					paymentSource: "extra_untracked",
					adjustBalances: false,
					resetOnDecrease: false,
				});
			})
		);
	}

	const filtered = visibleDebts.filter((d) => !isNonDebtCategoryName(d.sourceCategoryName));
	const syntheticPaidCarryovers = await buildSyntheticPaidCarryovers({ budgetPlanId, sourceExpenseIds, defaultDueDay });
	const mappedDebts = filtered.map((d) => mapDebtWithExpenseState(d, expenseById));
	return [...mappedDebts, ...syntheticPaidCarryovers];
}

async function buildSyntheticPaidCarryovers(params: {
	budgetPlanId: string;
	sourceExpenseIds: string[];
	defaultDueDay: number;
}): Promise<DebtItem[]> {
	const { budgetPlanId, sourceExpenseIds, defaultDueDay } = params;
	const paidExpensesWithoutDebt = await fetchPaidExpensesWithoutDebt(budgetPlanId, sourceExpenseIds);
	const paidExpenseIds = paidExpensesWithoutDebt.map((e) => e.id);
	const latestExpensePayments = paidExpenseIds.length
		? await prisma.expensePayment.groupBy({ by: ["expenseId"], where: { expenseId: { in: paidExpenseIds } }, _max: { paidAt: true } })
		: [];
	const latestExpensePaymentByExpenseId = new Map(latestExpensePayments.map((row) => [row.expenseId, row._max.paidAt ?? null] as const));

	return paidExpensesWithoutDebt
		.filter((expense) => {
			if (isNonDebtCategoryName(expense.category?.name)) return false;
			const totalAmount = Number(expense.amount);
			const paidAmount = Number(expense.paidAmount);
			if (!(Number.isFinite(totalAmount - paidAmount) && totalAmount - paidAmount <= 0)) return false;

			const dueDate = resolveExpenseDueDate({ year: expense.year, month: expense.month, dueDate: expense.dueDate, defaultDueDay });
			const overdueThreshold = addDays(dueDate, OVERDUE_GRACE_DAYS);
			const explicitPaidAt = latestExpensePaymentByExpenseId.get(expense.id) ?? null;
			const latestPaymentAt = explicitPaidAt ?? expense.updatedAt;
			if (!latestPaymentAt || latestPaymentAt.getTime() <= overdueThreshold.getTime()) return false;
			if (!explicitPaidAt) {
				const fallbackWindowMs = 14 * 24 * 60 * 60 * 1000;
				if (latestPaymentAt.getTime() - overdueThreshold.getTime() > fallbackWindowMs) return false;
			}
			return true;
		})
		.map((expense) => {
			const normalizedAmount = Math.max(0, Number(expense.amount) || 0);
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
				sourceMonthKey: monthNumberToKey(expense.month),
				sourceCategoryId: expense.category?.id,
				sourceCategoryName: expense.category?.name,
				sourceExpenseName: expense.name,
			};
		});
}

function mapDebtWithExpenseState(d: ExpenseDebtRow, expenseById: Map<string, ExpenseDebtVisibilityRow>): DebtItem {
	const createdAt = d.createdAt instanceof Date ? d.createdAt : new Date(d.createdAt);
	const expenseId = String(d.sourceExpenseId ?? "").trim();
	const expense = expenseId ? expenseById.get(expenseId) : undefined;
	const initialBalance = Number(d.initialBalance);
	const computedInitial = Number.isFinite(initialBalance) && initialBalance > 0 ? initialBalance : Number(expense?.amount ?? d.amount);
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
}

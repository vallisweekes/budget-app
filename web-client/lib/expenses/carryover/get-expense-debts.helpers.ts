import { prisma } from "@/lib/prisma";

type NumericValue = number | string | null;

export type ExpenseDebtRow = {
	id: string;
	name: string;
	type: string;
	initialBalance: NumericValue;
	currentBalance: NumericValue;
	amount: NumericValue;
	paid: boolean;
	paidAmount: NumericValue;
	monthlyMinimum: NumericValue;
	interestRate: NumericValue;
	installmentMonths: number | null;
	createdAt: Date | string;
	sourceExpenseId: string | null;
	sourceMonthKey: string | null;
	sourceCategoryId: string | null;
	sourceCategoryName: string | null;
	sourceExpenseName: string | null;
};

export type ExpenseDebtVisibilityRow = {
	id: string;
	amount: NumericValue;
	paidAmount: NumericValue;
	paid: boolean;
	isAllocation: boolean;
	dueDate: Date | null;
	year: number;
	month: number;
	category: { name: string } | null;
};

export type LatePaidExpenseRow = {
	id: string;
	name: string;
	amount: NumericValue;
	paidAmount: NumericValue;
	paid: boolean;
	isAllocation: boolean;
	dueDate: Date | null;
	year: number;
	month: number;
	updatedAt: Date;
	category: { id: string; name: string } | null;
};

function isDebtTypeEnumMismatchError(error: unknown): boolean {
	const message = String((error as { message?: unknown })?.message ?? error);
	return message.includes("not found in enum 'DebtType'") || message.includes('not found in enum "DebtType"');
}

export async function fetchExpenseDebtRows(budgetPlanId: string): Promise<ExpenseDebtRow[]> {
	try {
		return (await prisma.debt.findMany({
			where: { budgetPlanId, sourceType: "expense" },
			orderBy: { createdAt: "desc" },
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
		return prisma.$queryRaw<ExpenseDebtRow[]>`
			SELECT
				"id", "name", "type"::text AS "type", "initialBalance", "currentBalance", "amount", "paid", "paidAmount",
				"monthlyMinimum", "interestRate", "installmentMonths", "createdAt", "sourceExpenseId", "sourceMonthKey",
				"sourceCategoryId", "sourceCategoryName", "sourceExpenseName"
			FROM "Debt"
			WHERE "budgetPlanId" = ${budgetPlanId}
				AND "sourceType" = 'expense'
			ORDER BY "createdAt" DESC
		`;
	}
}

export async function fetchLinkedExpenses(budgetPlanId: string, sourceExpenseIds: string[]) {
	if (sourceExpenseIds.length === 0) return [] as ExpenseDebtVisibilityRow[];
	const rows = await prisma.expense.findMany({
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
	});
	return rows as unknown as ExpenseDebtVisibilityRow[];
}

export async function fetchPaidExpensesWithoutDebt(budgetPlanId: string, sourceExpenseIds: string[]) {
	const rows = await prisma.expense.findMany({
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
	});
	return rows as unknown as LatePaidExpenseRow[];
}

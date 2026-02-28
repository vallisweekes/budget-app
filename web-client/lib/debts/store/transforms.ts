import type { DebtItem, DebtPayment } from "@/types";
import { prisma } from "@/lib/prisma";
import { decimalToNumber, paymentMonthKeyFromDate } from "./shared";

export async function resolveBudgetYear(budgetPlanId: string): Promise<number> {
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

type DebtRowLike = {
	id: string;
	name: string;
	logoUrl?: string | null;
	type: DebtItem["type"] | string;
	creditLimit?: unknown | null;
	dueDay?: number | null;
	dueDate?: Date | string | null;
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
	createdAt: Date | string;
	sourceType: string | null;
	sourceExpenseId: string | null;
	sourceMonthKey: string | null;
	sourceCategoryId: string | null;
	sourceCategoryName: string | null;
	sourceExpenseName: string | null;
};

export function serializeDebt(row: DebtRowLike): DebtItem {
	const createdAt = row.createdAt instanceof Date ? row.createdAt : new Date(row.createdAt);
	const dueDate = row.dueDate == null ? undefined : row.dueDate instanceof Date ? row.dueDate : new Date(row.dueDate);
	return {
		id: row.id,
		name: row.name,
		logoUrl: typeof row.logoUrl === "string" && row.logoUrl.trim() ? row.logoUrl : undefined,
		type: row.type as DebtItem["type"],
		creditLimit: row.creditLimit == null ? undefined : decimalToNumber(row.creditLimit),
		dueDay: row.dueDay == null ? undefined : Number(row.dueDay),
		dueDate: dueDate?.toISOString(),
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
		createdAt: createdAt.toISOString(),
		sourceType: row.sourceType === "expense" ? "expense" : undefined,
		sourceExpenseId: row.sourceExpenseId ?? undefined,
		sourceMonthKey: row.sourceMonthKey ?? undefined,
		sourceCategoryId: row.sourceCategoryId ?? undefined,
		sourceCategoryName: row.sourceCategoryName ?? undefined,
		sourceExpenseName: row.sourceExpenseName ?? undefined,
	};
}

type PaymentRowLike = {
	id: string;
	debtId: string;
	amount: unknown;
	paidAt: Date;
	source?: unknown;
	cardDebtId?: string | null;
};

export function serializePayment(row: PaymentRowLike): DebtPayment {
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

export function isDebtTypeEnumMismatchError(error: unknown): boolean {
	const message =
		typeof error === "object" && error && "message" in error
			? String((error as { message?: unknown }).message ?? error)
			: String(error);
	return message.includes("not found in enum 'DebtType'") || message.includes('not found in enum "DebtType"');
}

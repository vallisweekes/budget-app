import type { DebtItem } from "@/types";
import { prisma } from "@/lib/prisma";
import {
	DEBT_HAS_CREDIT_LIMIT,
	DEBT_HAS_DUE_DAY,
	DEBT_HAS_DUE_DATE,
	DEBT_HAS_DEFAULT_PAYMENT_SOURCE,
	DEBT_HAS_DEFAULT_PAYMENT_CARD_DEBT_ID,
	debtSelect,
	decimalToNumber,
} from "./shared";
import { serializeDebt } from "./transforms";

type DebtCreateData = Parameters<typeof prisma.debt.create>[0]["data"];
type DebtUpdateData = Parameters<typeof prisma.debt.update>[0]["data"];

export async function addDebt(
	budgetPlanId: string,
	debt: Omit<DebtItem, "id" | "createdAt" | "currentBalance" | "paid" | "paidAmount" | "amount">
): Promise<DebtItem> {
	const installmentMonths = debt.installmentMonths ?? null;
	const monthlyMinimum = debt.monthlyMinimum ?? null;
	let dueAmount = debt.initialBalance;
	if (installmentMonths && installmentMonths > 0) dueAmount = debt.initialBalance / installmentMonths;
	if (monthlyMinimum != null && Number.isFinite(monthlyMinimum)) dueAmount = Math.max(dueAmount, monthlyMinimum);

	const created = await prisma.debt.create({
		data: {
			budgetPlanId,
			name: debt.name,
			type: debt.type as DebtCreateData["type"],
			...(DEBT_HAS_CREDIT_LIMIT ? { creditLimit: debt.creditLimit ?? null } : {}),
			...(DEBT_HAS_DUE_DAY ? { dueDay: debt.dueDay ?? null } : {}),
			...(DEBT_HAS_DUE_DATE ? { dueDate: debt.dueDate ?? null } : {}),
			...(DEBT_HAS_DEFAULT_PAYMENT_SOURCE ? { defaultPaymentSource: debt.defaultPaymentSource ?? "income" } : {}),
			...(DEBT_HAS_DEFAULT_PAYMENT_CARD_DEBT_ID
				? { defaultPaymentCardDebtId: debt.defaultPaymentCardDebtId ?? null }
				: {}),
			initialBalance: debt.initialBalance,
			currentBalance: debt.initialBalance,
			amount: dueAmount,
			paid: false,
			paidAmount: 0,
			monthlyMinimum: debt.monthlyMinimum ?? null,
			interestRate: debt.interestRate ?? null,
			installmentMonths: debt.installmentMonths ?? null,
			sourceType: debt.sourceType ?? null,
			sourceExpenseId: debt.sourceExpenseId ?? null,
			sourceMonthKey: debt.sourceMonthKey ?? null,
			sourceCategoryId: debt.sourceCategoryId ?? null,
			sourceCategoryName: debt.sourceCategoryName ?? null,
			sourceExpenseName: debt.sourceExpenseName ?? null,
		},
		select: debtSelect(),
	});
	return serializeDebt(created);
}

export async function upsertExpenseDebt(params: {
	budgetPlanId: string;
	expenseId: string;
	monthKey: string;
	year?: number;
	categoryId?: string;
	categoryName?: string;
	expenseName: string;
	remainingAmount: number;
}): Promise<DebtItem | null> {
	const { budgetPlanId, expenseId, monthKey, year, categoryId, categoryName, expenseName, remainingAmount } = params;
	const existing = await prisma.debt.findFirst({
		where: { budgetPlanId, sourceType: "expense", sourceExpenseId: expenseId },
		select: debtSelect(),
	});

	if (!Number.isFinite(remainingAmount) || remainingAmount <= 0) {
		if (!existing) return null;
		const updated = await prisma.debt.update({
			where: { id: existing.id },
			data: { currentBalance: 0, paid: true, paidAmount: existing.initialBalance },
			select: debtSelect(),
		});
		return serializeDebt(updated);
	}

	if (existing) {
		const initialBalance = decimalToNumber(existing.initialBalance);
		const updated = await prisma.debt.update({
			where: { id: existing.id },
			data: {
				currentBalance: remainingAmount,
				paid: false,
				paidAmount: Math.max(0, initialBalance - remainingAmount),
				sourceCategoryId: categoryId ?? undefined,
				sourceCategoryName: categoryName ?? undefined,
				sourceExpenseName: expenseName ?? undefined,
				name: existing.name,
			},
			select: debtSelect(),
		});
		return serializeDebt(updated);
	}

	const displayCategory = categoryName ? `${categoryName}: ` : "";
	const displayPeriod = year ? ` (${monthKey} ${year})` : ` (${monthKey})`;
	const created = await prisma.debt.create({
		data: {
			budgetPlanId,
			name: `${displayCategory}${expenseName}${displayPeriod}`,
			type: "other",
			initialBalance: remainingAmount,
			currentBalance: remainingAmount,
			amount: remainingAmount,
			paid: false,
			paidAmount: 0,
			sourceType: "expense",
			sourceExpenseId: expenseId,
			sourceMonthKey: monthKey,
			sourceCategoryId: categoryId ?? null,
			sourceCategoryName: categoryName ?? null,
			sourceExpenseName: expenseName,
		},
		select: debtSelect(),
	});
	return serializeDebt(created);
}

export async function updateDebt(
	budgetPlanId: string,
	id: string,
	updates: Partial<Omit<DebtItem, "id" | "createdAt">>
): Promise<DebtItem | null> {
	const existing = await prisma.debt.findFirst({ where: { id, budgetPlanId }, select: { id: true } });
	if (!existing) return null;
	const updateData: DebtUpdateData = {
		name: updates.name,
		...(DEBT_HAS_CREDIT_LIMIT
			? {
				creditLimit: updates.creditLimit === undefined ? undefined : updates.creditLimit ?? null,
			}
			: {}),
		...(DEBT_HAS_DUE_DAY
			? {
				dueDay: updates.dueDay === undefined ? undefined : updates.dueDay ?? null,
			}
			: {}),
		...(DEBT_HAS_DUE_DATE
			? {
				dueDate: updates.dueDate === undefined ? undefined : updates.dueDate ?? null,
			}
			: {}),
		...(DEBT_HAS_DEFAULT_PAYMENT_SOURCE
			? {
				defaultPaymentSource:
					updates.defaultPaymentSource === undefined ? undefined : updates.defaultPaymentSource ?? "income",
			}
			: {}),
		...(DEBT_HAS_DEFAULT_PAYMENT_CARD_DEBT_ID
			? {
				defaultPaymentCardDebtId:
					updates.defaultPaymentCardDebtId === undefined
						? undefined
						: updates.defaultPaymentCardDebtId ?? null,
			}
			: {}),
		initialBalance: updates.initialBalance,
		currentBalance: updates.currentBalance,
		monthlyMinimum: updates.monthlyMinimum === undefined ? undefined : updates.monthlyMinimum ?? null,
		interestRate: updates.interestRate === undefined ? undefined : updates.interestRate ?? null,
		installmentMonths: updates.installmentMonths === undefined ? undefined : updates.installmentMonths ?? null,
		paid: updates.paid,
		paidAmount: updates.paidAmount,
		amount: updates.amount,
	};

	const updated = await prisma.debt.update({
		where: { id: existing.id },
		data: updateData,
		select: debtSelect(),
	});
	return serializeDebt(updated);
}

export async function deleteDebt(budgetPlanId: string, id: string): Promise<boolean> {
	const deleted = await prisma.debt.deleteMany({ where: { id, budgetPlanId } });
	return deleted.count > 0;
}

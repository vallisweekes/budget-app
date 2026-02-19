"use server";

import { revalidatePath } from "next/cache";
import { addDebt, updateDebt, deleteDebt, addPayment, getDebtById } from "./store";
import type { DebtType, MonthKey } from "@/types";
import { applyExpensePayment } from "@/lib/expenses/store";
import { upsertExpenseDebt } from "./store";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveUserId } from "@/lib/budgetPlans";

function requireBudgetPlanId(formData: FormData): string {
	const raw = formData.get("budgetPlanId");
	const budgetPlanId = String(raw ?? "").trim();
	if (!budgetPlanId) throw new Error("Missing budgetPlanId");
	return budgetPlanId;
}

async function requireAuthenticatedUser() {
	const session = await getServerSession(authOptions);
	const sessionUser = session?.user;
	const sessionUsername = sessionUser?.username ?? sessionUser?.name;
	if (!sessionUser || !sessionUsername) throw new Error("Not authenticated");
	const userId = await resolveUserId({ userId: sessionUser.id, username: sessionUsername });
	return { userId };
}

async function requireOwnedBudgetPlan(budgetPlanId: string, userId: string) {
	const plan = await prisma.budgetPlan.findUnique({ where: { id: budgetPlanId }, select: { id: true, userId: true } });
	if (!plan || plan.userId !== userId) throw new Error("Budget plan not found");
	return plan;
}

export async function createDebt(formData: FormData) {
	const budgetPlanId = requireBudgetPlanId(formData);
	const { userId } = await requireAuthenticatedUser();
	await requireOwnedBudgetPlan(budgetPlanId, userId);
	const name = formData.get("name") as string;
	const type = formData.get("type") as DebtType;
	const dueDayRaw = formData.get("dueDay");
	const dueDay = dueDayRaw != null && String(dueDayRaw).trim() !== "" ? parseInt(String(dueDayRaw), 10) : undefined;
	const rawDefaultPaymentSource = String(formData.get("defaultPaymentSource") ?? "income").trim();
	const defaultPaymentSource =
		rawDefaultPaymentSource === "credit_card"
			? "credit_card"
			: rawDefaultPaymentSource === "extra_funds"
				? "extra_funds"
				: "income";
	const defaultPaymentCardDebtId = String(formData.get("defaultPaymentCardDebtId") ?? "").trim();
	const initialBalance = parseFloat(formData.get("initialBalance") as string);
	const creditLimitRaw = formData.get("creditLimit");
	const creditLimit = creditLimitRaw != null && String(creditLimitRaw).trim() !== ""
		? parseFloat(String(creditLimitRaw))
		: undefined;
	const monthlyMinimum = formData.get("monthlyMinimum") ? parseFloat(formData.get("monthlyMinimum") as string) : undefined;
	const interestRate = formData.get("interestRate") ? parseFloat(formData.get("interestRate") as string) : undefined;
	const installmentMonthsRaw = formData.get("installmentMonths") as string | null;
	const installmentMonths = installmentMonthsRaw ? parseInt(installmentMonthsRaw, 10) : undefined;

	if (!name || !type || isNaN(initialBalance)) {
		throw new Error("Invalid input");
	}

	if (dueDay != null) {
		if (!Number.isFinite(dueDay) || dueDay < 1 || dueDay > 31) {
			throw new Error("Due day must be between 1 and 31");
		}
	}

	if (defaultPaymentSource === "credit_card" && !defaultPaymentCardDebtId) {
		throw new Error("Default card is required when payment source is credit card");
	}

	if (type === "credit_card" || (type as any) === "store_card") {
		if (creditLimit == null || !Number.isFinite(creditLimit) || creditLimit <= 0) {
			throw new Error("Credit limit is required for credit card debts");
		}
	}

	await addDebt(budgetPlanId, {
		name,
		type,
		dueDay,
		defaultPaymentSource,
		defaultPaymentCardDebtId: defaultPaymentSource === "credit_card" ? defaultPaymentCardDebtId : undefined,
		creditLimit,
		initialBalance,
		monthlyMinimum,
		interestRate,
		installmentMonths,
	});

	revalidatePath("/admin/debts");
	revalidatePath("/");
}

export async function updateDebtAction(id: string, formData: FormData) {
	const budgetPlanId = requireBudgetPlanId(formData);
	const { userId } = await requireAuthenticatedUser();
	await requireOwnedBudgetPlan(budgetPlanId, userId);

	const existing = await getDebtById(budgetPlanId, id);
	if (!existing) throw new Error("Debt not found");

	const name = formData.get("name") as string;
	const dueDayRaw = formData.get("dueDay");
	const dueDay = dueDayRaw != null && String(dueDayRaw).trim() !== "" ? parseInt(String(dueDayRaw), 10) : undefined;
	const rawDefaultPaymentSource = formData.get("defaultPaymentSource");
	const defaultPaymentSource =
		rawDefaultPaymentSource == null
			? undefined
			: String(rawDefaultPaymentSource).trim() === "credit_card"
				? "credit_card"
				: String(rawDefaultPaymentSource).trim() === "extra_funds"
					? "extra_funds"
					: "income";
	const defaultPaymentCardDebtId = String(formData.get("defaultPaymentCardDebtId") ?? "").trim();
	const initialBalance = formData.get("initialBalance") ? parseFloat(formData.get("initialBalance") as string) : undefined;
	const currentBalance = parseFloat(formData.get("currentBalance") as string);
	const amount = formData.get("amount") ? parseFloat(formData.get("amount") as string) : undefined;
	const creditLimitRaw = formData.get("creditLimit");
	const hasCreditLimitValue = creditLimitRaw != null && String(creditLimitRaw).trim() !== "";
	const creditLimit = hasCreditLimitValue ? parseFloat(String(creditLimitRaw)) : undefined;
	const monthlyMinimum = formData.get("monthlyMinimum") ? parseFloat(formData.get("monthlyMinimum") as string) : undefined;
	const interestRate = formData.get("interestRate") ? parseFloat(formData.get("interestRate") as string) : undefined;
	const installmentMonthsRaw = formData.get("installmentMonths") as string | null;
	const installmentMonths = installmentMonthsRaw ? parseInt(installmentMonthsRaw, 10) : undefined;

	if (!name || isNaN(currentBalance)) {
		throw new Error("Invalid input");
	}

	if (dueDay != null) {
		if (!Number.isFinite(dueDay) || dueDay < 1 || dueDay > 31) {
			throw new Error("Due day must be between 1 and 31");
		}
	}

	if (defaultPaymentSource === "credit_card" && !defaultPaymentCardDebtId) {
		throw new Error("Default card is required when payment source is credit card");
	}

	if ((existing.type === "credit_card" || (existing.type as any) === "store_card") && hasCreditLimitValue) {
		// Only validate when a non-empty value is provided.
		// This prevents partial edit flows (or older cached PWA bundles) from crashing the app
		// by submitting an empty creditLimit.
		if (creditLimit == null || !Number.isFinite(creditLimit) || creditLimit <= 0) {
			throw new Error("Credit limit must be a positive number");
		}
	}

	if (existing.sourceType === "expense" && existing.sourceExpenseId) {
		const expense = await prisma.expense.findFirst({
			where: { id: existing.sourceExpenseId, budgetPlanId },
			select: { id: true, amount: true, paidAmount: true },
		});
		if (!expense) throw new Error("Source expense not found");

		const expenseAmount = Number((expense.amount as any)?.toString?.() ?? expense.amount);
		let nextExpenseAmount = Number.isFinite(initialBalance as number)
			? Math.max(0, initialBalance as number)
			: expenseAmount;

		if (currentBalance > nextExpenseAmount) {
			nextExpenseAmount = currentBalance;
		}

		const nextPaidAmount = Math.max(0, Math.min(nextExpenseAmount, nextExpenseAmount - currentBalance));
		const nextPaid = nextExpenseAmount > 0 && nextPaidAmount >= nextExpenseAmount;

		await prisma.expense.update({
			where: { id: expense.id },
			data: {
				name,
				amount: nextExpenseAmount,
				paidAmount: nextPaid ? nextExpenseAmount : nextPaidAmount,
				paid: nextPaid,
			},
		});

		await updateDebt(budgetPlanId, id, {
			name,
			dueDay,
			defaultPaymentSource,
			defaultPaymentCardDebtId:
				defaultPaymentSource === undefined
					? undefined
					: defaultPaymentSource === "credit_card"
						? defaultPaymentCardDebtId
						: (null as any),
			creditLimit: hasCreditLimitValue ? creditLimit : undefined,
			initialBalance: nextExpenseAmount,
			currentBalance,
			paid: nextPaid,
			paidAmount: nextPaid ? nextExpenseAmount : nextPaidAmount,
			amount,
			monthlyMinimum,
			interestRate,
			installmentMonths,
		});
	} else {
		await updateDebt(budgetPlanId, id, {
			name,
			dueDay,
			defaultPaymentSource,
			defaultPaymentCardDebtId:
				defaultPaymentSource === undefined
					? undefined
					: defaultPaymentSource === "credit_card"
						? defaultPaymentCardDebtId
						: (null as any),
			creditLimit: hasCreditLimitValue ? creditLimit : undefined,
			initialBalance,
			currentBalance,
			amount,
			monthlyMinimum,
			interestRate,
			installmentMonths,
		});
	}

	revalidatePath("/admin/debts");
	revalidatePath("/");
}

export async function deleteDebtAction(budgetPlanId: string, id: string) {
	const { userId } = await requireAuthenticatedUser();
	await requireOwnedBudgetPlan(budgetPlanId, userId);
	const existing = await getDebtById(budgetPlanId, id);
	if (existing?.sourceType === "expense" && existing.currentBalance > 0) {
		throw new Error("Cannot delete an unpaid expense debt. Mark the expense as paid first.");
	}
	await deleteDebt(budgetPlanId, id);
	revalidatePath("/admin/debts");
	revalidatePath("/");
}

export async function makePaymentAction(budgetPlanId: string, debtId: string, amount: number, month: string) {
	if (isNaN(amount) || amount <= 0) {
		throw new Error("Invalid payment amount");
	}
	const { userId } = await requireAuthenticatedUser();
	await requireOwnedBudgetPlan(budgetPlanId, userId);

	await addPayment(budgetPlanId, debtId, amount, month, "income");

	const debt = await getDebtById(budgetPlanId, debtId);
	if (debt?.sourceType === "expense" && debt.sourceExpenseId && debt.sourceMonthKey) {
		const result = await applyExpensePayment(
			budgetPlanId,
			debt.sourceMonthKey as MonthKey,
			debt.sourceExpenseId,
			amount
		);
		if (result) {
			await upsertExpenseDebt({
				budgetPlanId,
				expenseId: result.expense.id,
				monthKey: debt.sourceMonthKey,
				categoryId: result.expense.categoryId,
				categoryName: debt.sourceCategoryName,
				expenseName: result.expense.name,
				remainingAmount: result.remaining,
			});
		}
	}

	revalidatePath("/admin/debts");
	revalidatePath("/");
}

export async function makePaymentFromForm(formData: FormData) {
	const budgetPlanId = requireBudgetPlanId(formData);
	const { userId } = await requireAuthenticatedUser();
	await requireOwnedBudgetPlan(budgetPlanId, userId);
	const debtId = formData.get("debtId") as string;
	const amount = parseFloat(formData.get("amount") as string);
	const month = formData.get("month") as string;
	const rawSource = String(formData.get("source") ?? "income").trim();
	const source = rawSource === "credit_card" ? "credit_card" : rawSource === "extra_funds" ? "extra_funds" : "income";
	const cardDebtId = String(formData.get("cardDebtId") ?? "").trim();

	if (!debtId || isNaN(amount) || amount <= 0) {
		throw new Error("Invalid payment data");
	}

	if (source === "credit_card" && !cardDebtId) {
		throw new Error("Card is required when payment source is credit card");
	}

	await addPayment(budgetPlanId, debtId, amount, month, source, cardDebtId || undefined);

	const debt = await getDebtById(budgetPlanId, debtId);
	if (debt?.sourceType === "expense" && debt.sourceExpenseId && debt.sourceMonthKey) {
		const result = await applyExpensePayment(
			budgetPlanId,
			debt.sourceMonthKey as MonthKey,
			debt.sourceExpenseId,
			amount
		);
		if (result) {
			await upsertExpenseDebt({
				budgetPlanId,
				expenseId: result.expense.id,
				monthKey: debt.sourceMonthKey,
				categoryId: result.expense.categoryId,
				categoryName: debt.sourceCategoryName,
				expenseName: result.expense.name,
				remainingAmount: result.remaining,
			});
		}
	}

	revalidatePath("/admin/debts");
	revalidatePath("/");
}

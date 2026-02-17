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
	const initialBalance = parseFloat(formData.get("initialBalance") as string);
	const monthlyMinimum = formData.get("monthlyMinimum") ? parseFloat(formData.get("monthlyMinimum") as string) : undefined;
	const interestRate = formData.get("interestRate") ? parseFloat(formData.get("interestRate") as string) : undefined;
	const installmentMonthsRaw = formData.get("installmentMonths") as string | null;
	const installmentMonths = installmentMonthsRaw ? parseInt(installmentMonthsRaw, 10) : undefined;

	if (!name || !type || isNaN(initialBalance)) {
		throw new Error("Invalid input");
	}

	await addDebt(budgetPlanId, {
		name,
		type,
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
	const name = formData.get("name") as string;
	const initialBalance = formData.get("initialBalance") ? parseFloat(formData.get("initialBalance") as string) : undefined;
	const currentBalance = parseFloat(formData.get("currentBalance") as string);
	const amount = formData.get("amount") ? parseFloat(formData.get("amount") as string) : undefined;
	const monthlyMinimum = formData.get("monthlyMinimum") ? parseFloat(formData.get("monthlyMinimum") as string) : undefined;
	const interestRate = formData.get("interestRate") ? parseFloat(formData.get("interestRate") as string) : undefined;
	const installmentMonthsRaw = formData.get("installmentMonths") as string | null;
	const installmentMonths = installmentMonthsRaw ? parseInt(installmentMonthsRaw, 10) : undefined;

	if (!name || isNaN(currentBalance)) {
		throw new Error("Invalid input");
	}

	await updateDebt(budgetPlanId, id, {
		name,
		initialBalance,
		currentBalance,
		amount,
		monthlyMinimum,
		interestRate,
		installmentMonths,
	});

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
	const source = rawSource === "extra_funds" ? "extra_funds" : "income";

	if (!debtId || isNaN(amount) || amount <= 0) {
		throw new Error("Invalid payment data");
	}

	await addPayment(budgetPlanId, debtId, amount, month, source);

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

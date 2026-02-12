"use server";

import { revalidatePath } from "next/cache";
import { addDebt, updateDebt, deleteDebt, addPayment, getDebtById } from "./store";
import type { DebtType, MonthKey } from "@/types";
import { applyExpensePayment } from "@/lib/expenses/store";
import { upsertExpenseDebt } from "./store";

function requireBudgetPlanId(formData: FormData): string {
	const raw = formData.get("budgetPlanId");
	const budgetPlanId = String(raw ?? "").trim();
	if (!budgetPlanId) throw new Error("Missing budgetPlanId");
	return budgetPlanId;
}

export async function createDebt(formData: FormData) {
	const budgetPlanId = requireBudgetPlanId(formData);
	const name = formData.get("name") as string;
	const type = formData.get("type") as DebtType;
	const initialBalance = parseFloat(formData.get("initialBalance") as string);
	const monthlyMinimum = formData.get("monthlyMinimum") ? parseFloat(formData.get("monthlyMinimum") as string) : undefined;
	const interestRate = formData.get("interestRate") ? parseFloat(formData.get("interestRate") as string) : undefined;

	if (!name || !type || isNaN(initialBalance)) {
		throw new Error("Invalid input");
	}

	addDebt(budgetPlanId, {
		name,
		type,
		initialBalance,
		monthlyMinimum,
		interestRate,
	});

	revalidatePath("/admin/debts");
	revalidatePath("/");
}

export async function updateDebtAction(id: string, formData: FormData) {
	const budgetPlanId = requireBudgetPlanId(formData);
	const name = formData.get("name") as string;
	const currentBalance = parseFloat(formData.get("currentBalance") as string);
	const monthlyMinimum = formData.get("monthlyMinimum") ? parseFloat(formData.get("monthlyMinimum") as string) : undefined;
	const interestRate = formData.get("interestRate") ? parseFloat(formData.get("interestRate") as string) : undefined;

	if (!name || isNaN(currentBalance)) {
		throw new Error("Invalid input");
	}

	updateDebt(budgetPlanId, id, {
		name,
		currentBalance,
		monthlyMinimum,
		interestRate,
	});

	revalidatePath("/admin/debts");
	revalidatePath("/");
}

export async function deleteDebtAction(budgetPlanId: string, id: string) {
	deleteDebt(budgetPlanId, id);
	revalidatePath("/admin/debts");
	revalidatePath("/");
}

export async function makePaymentAction(budgetPlanId: string, debtId: string, amount: number, month: string) {
	if (isNaN(amount) || amount <= 0) {
		throw new Error("Invalid payment amount");
	}

	addPayment(budgetPlanId, debtId, amount, month);

	const debt = getDebtById(budgetPlanId, debtId);
	if (debt?.sourceType === "expense" && debt.sourceExpenseId && debt.sourceMonthKey) {
		const result = await applyExpensePayment(
			budgetPlanId,
			debt.sourceMonthKey as MonthKey,
			debt.sourceExpenseId,
			amount
		);
		if (result) {
			upsertExpenseDebt({
				budgetPlanId,
				expenseId: result.expense.id,
				monthKey: debt.sourceMonthKey,
				year: debt.sourceYear,
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
	const debtId = formData.get("debtId") as string;
	const amount = parseFloat(formData.get("amount") as string);
	const month = formData.get("month") as string;

	if (!debtId || isNaN(amount) || amount <= 0) {
		throw new Error("Invalid payment data");
	}

	addPayment(budgetPlanId, debtId, amount, month);

	const debt = getDebtById(budgetPlanId, debtId);
	if (debt?.sourceType === "expense" && debt.sourceExpenseId && debt.sourceMonthKey) {
		const result = await applyExpensePayment(
			budgetPlanId,
			debt.sourceMonthKey as MonthKey,
			debt.sourceExpenseId,
			amount
		);
		if (result) {
			upsertExpenseDebt({
				budgetPlanId,
				expenseId: result.expense.id,
				monthKey: debt.sourceMonthKey,
				year: debt.sourceYear,
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

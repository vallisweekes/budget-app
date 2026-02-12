"use server";

import { addIncome, updateIncome, removeIncome } from "@/lib/income/store";
import type { MonthKey } from "@/types";

function requireBudgetPlanId(formData: FormData): string {
	const raw = formData.get("budgetPlanId");
	const budgetPlanId = String(raw ?? "").trim();
	if (!budgetPlanId) throw new Error("Missing budgetPlanId");
	return budgetPlanId;
}

export async function addIncomeAction(formData: FormData): Promise<void> {
	const budgetPlanId = requireBudgetPlanId(formData);
	const month = String(formData.get("month")) as MonthKey;
	const name = String(formData.get("name") || "").trim();
	const amount = Number(formData.get("amount") || 0);
	if (!name || !month) return;
	await addIncome(budgetPlanId, month, { name, amount });
}

export async function updateIncomeAction(
	budgetPlanId: string,
	month: MonthKey,
	id: string,
	name: string,
	amount: number
): Promise<void> {
	if (!name.trim()) return;
	await updateIncome(budgetPlanId, month, id, { name: name.trim(), amount });
}

export async function removeIncomeAction(budgetPlanId: string, month: MonthKey, id: string): Promise<void> {
	await removeIncome(budgetPlanId, month, id);
}

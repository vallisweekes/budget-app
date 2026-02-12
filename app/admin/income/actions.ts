"use server";

import { addIncome, updateIncome, removeIncome } from "@/lib/income/store";
import type { MonthKey } from "@/types";

export async function addIncomeAction(formData: FormData): Promise<void> {
	const month = String(formData.get("month")) as MonthKey;
	const name = String(formData.get("name") || "").trim();
	const amount = Number(formData.get("amount") || 0);
	if (!name || !month) return;
	await addIncome(month, { name, amount });
}

export async function updateIncomeAction(month: MonthKey, id: string, name: string, amount: number): Promise<void> {
	if (!name.trim()) return;
	await updateIncome(month, id, { name: name.trim(), amount });
}

export async function removeIncomeAction(month: MonthKey, id: string): Promise<void> {
	await removeIncome(month, id);
}

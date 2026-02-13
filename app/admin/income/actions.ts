"use server";

import { addOrUpdateIncomeAcrossMonths, updateIncome, removeIncome } from "@/lib/income/store";
import { MONTHS } from "@/lib/constants/time";
import type { MonthKey } from "@/types";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveUserId } from "@/lib/budgetPlans";

function isTruthyFormValue(value: FormDataEntryValue | null): boolean {
	if (value == null) return false;
	const v = String(value).trim().toLowerCase();
	return v === "1" || v === "true" || v === "on" || v === "yes";
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

	const distributeMonths = isTruthyFormValue(formData.get("distributeMonths"));
	const distributeYears = isTruthyFormValue(formData.get("distributeYears"));

	const { userId } = await requireAuthenticatedUser();
	await requireOwnedBudgetPlan(budgetPlanId, userId);

	const targetMonths: MonthKey[] = distributeMonths ? (MONTHS as MonthKey[]) : [month];
	const sharedId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

	if (distributeYears) {
		const plans = await prisma.budgetPlan.findMany({ where: { userId }, select: { id: true } });
		for (const p of plans) {
			await addOrUpdateIncomeAcrossMonths(p.id, targetMonths, { id: sharedId, name, amount });
		}
		return;
	}

	await addOrUpdateIncomeAcrossMonths(budgetPlanId, targetMonths, { id: sharedId, name, amount });
}

export async function updateIncomeItemAction(
	budgetPlanId: string,
	month: MonthKey,
	id: string,
	name: string,
	amount: number
): Promise<void> {
	if (!name.trim()) return;
	const { userId } = await requireAuthenticatedUser();
	await requireOwnedBudgetPlan(budgetPlanId, userId);
	await updateIncome(budgetPlanId, month, id, { name: name.trim(), amount });
}

export async function removeIncomeAction(budgetPlanId: string, month: MonthKey, id: string): Promise<void> {
	const { userId } = await requireAuthenticatedUser();
	await requireOwnedBudgetPlan(budgetPlanId, userId);
	await removeIncome(budgetPlanId, month, id);
}

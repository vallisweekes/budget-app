"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { addOrUpdateIncomeAcrossMonths, updateIncome, removeIncome } from "@/lib/income/store";
import { MONTHS } from "@/lib/constants/time";
import type { MonthKey } from "@/types";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveUserId } from "@/lib/budgetPlans";
import { monthKeyToNumber } from "@/lib/helpers/monthKey";
import { resolveActiveBudgetYear, upsertMonthlyAllocation } from "@/lib/allocations/store";
import { isMonthKey } from "@/lib/budget/zero-based";

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
	return { userId, sessionUsername };
}

function revalidateUserScopedBudgetPaths(sessionUsername: string, budgetPlanId: string) {
	const basePath = `/user=${encodeURIComponent(sessionUsername)}/${encodeURIComponent(budgetPlanId)}`;
	revalidatePath(basePath);
	revalidatePath(`${basePath}/income`);
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

	const { userId, sessionUsername } = await requireAuthenticatedUser();
	await requireOwnedBudgetPlan(budgetPlanId, userId);

	const targetMonths: MonthKey[] = distributeMonths ? (MONTHS as MonthKey[]) : [month];
	const sharedId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

	if (distributeYears) {
		const plans = await prisma.budgetPlan.findMany({ where: { userId }, select: { id: true } });
		for (const p of plans) {
			await addOrUpdateIncomeAcrossMonths(p.id, targetMonths, { id: sharedId, name, amount });
			if (sessionUsername) revalidateUserScopedBudgetPaths(sessionUsername, p.id);
		}
		revalidatePath("/");
		revalidatePath("/admin/income");
		return;
	}

	await addOrUpdateIncomeAcrossMonths(budgetPlanId, targetMonths, { id: sharedId, name, amount });
	if (sessionUsername) revalidateUserScopedBudgetPaths(sessionUsername, budgetPlanId);
	revalidatePath("/");
	revalidatePath("/admin/income");
}

export async function updateIncomeItemAction(
	budgetPlanId: string,
	month: MonthKey,
	id: string,
	name: string,
	amount: number
): Promise<void> {
	if (!name.trim()) return;
	const { userId, sessionUsername } = await requireAuthenticatedUser();
	await requireOwnedBudgetPlan(budgetPlanId, userId);
	await updateIncome(budgetPlanId, month, id, { name: name.trim(), amount });
	if (sessionUsername) revalidateUserScopedBudgetPaths(sessionUsername, budgetPlanId);
	revalidatePath("/");
	revalidatePath("/admin/income");
}

export async function removeIncomeAction(budgetPlanId: string, month: MonthKey, id: string): Promise<void> {
	const { userId, sessionUsername } = await requireAuthenticatedUser();
	await requireOwnedBudgetPlan(budgetPlanId, userId);
	await removeIncome(budgetPlanId, month, id);
	if (sessionUsername) revalidateUserScopedBudgetPaths(sessionUsername, budgetPlanId);
	revalidatePath("/");
	revalidatePath("/admin/income");
}

export async function saveAllocationsAction(formData: FormData): Promise<void> {
	const budgetPlanId = requireBudgetPlanId(formData);
	const { userId } = await requireAuthenticatedUser();
	await requireOwnedBudgetPlan(budgetPlanId, userId);

	const rawMonth = String(formData.get("month") ?? "").trim();
	if (!isMonthKey(rawMonth)) {
		throw new Error("Invalid allocation month");
	}
	const monthKey = rawMonth as MonthKey;
	const month = monthKeyToNumber(monthKey);
	const year = await resolveActiveBudgetYear(budgetPlanId);

	const parseMoney = (key: string) => {
		const raw = Number(formData.get(key));
		return Number.isFinite(raw) ? raw : 0;
	};

	await upsertMonthlyAllocation(budgetPlanId, year, month, {
		monthlyAllowance: parseMoney("monthlyAllowance"),
		monthlySavingsContribution: parseMoney("monthlySavingsContribution"),
		monthlyEmergencyContribution: parseMoney("monthlyEmergencyContribution"),
		monthlyInvestmentContribution: parseMoney("monthlyInvestmentContribution"),
	});

	const session = await getServerSession(authOptions);
	const sessionUser = session?.user;
	const sessionUsername = sessionUser?.username ?? sessionUser?.name;
	if (sessionUsername) {
		const incomePath = `/user=${encodeURIComponent(sessionUsername)}/${encodeURIComponent(budgetPlanId)}/income`;
		revalidatePath(incomePath);
		// Keep these broad revalidations consistent with existing income actions.
		revalidatePath("/");
		revalidatePath("/admin/income");
		// Redirect so the user gets immediate confirmation and avoids form re-submission on refresh.
		redirect(
			`${incomePath}?month=${encodeURIComponent(monthKey)}&saved=${encodeURIComponent("allocations")}`
		);
	}
	// Keep these broad revalidations consistent with existing income actions.
	revalidatePath("/");
	revalidatePath("/admin/income");
}

"use server";

import { saveSettings } from "@/lib/settings/store";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { resolveUserId } from "@/lib/budgetPlans";
import { prisma } from "@/lib/prisma";
import { getZeroBasedSummary, isMonthKey } from "@/lib/budget/zero-based";
import { monthKeyToNumber } from "@/lib/helpers/monthKey";
import { getMonthlyAllocationSnapshot, upsertMonthlyAllocation } from "@/lib/allocations/store";
import fs from "node:fs/promises";
import { getBudgetDataDir } from "@/lib/storage/budgetDataPath";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function getBudgetPlanDeleteImpactAction(budgetPlanId: string): Promise<{
	plan: { id: string; name: string; kind: string };
	counts: {
		categories: number;
		expenses: number;
		income: number;
		debts: number;
		goals: number;
	};
}> {
	const session = await getServerSession(authOptions);
	const sessionUser = session?.user;
	const sessionUsername = sessionUser?.username ?? sessionUser?.name;
	if (!sessionUser || !sessionUsername) {
		throw new Error("Not authenticated");
	}

	const planId = String(budgetPlanId ?? "").trim();
	if (!planId) throw new Error("Missing budgetPlanId");

	const userId = await resolveUserId({ userId: sessionUser.id, username: sessionUsername });
	const plan = await prisma.budgetPlan.findUnique({
		where: { id: planId },
		select: { id: true, userId: true, name: true, kind: true },
	});
	if (!plan || plan.userId !== userId) {
		throw new Error("Budget plan not found");
	}

	if (String(plan.kind).toLowerCase() === "personal") {
		throw new Error("Personal plans cannot be deleted");
	}

	const [categories, expenses, income, debts, goals] = await Promise.all([
		prisma.category.count({ where: { budgetPlanId: planId } }),
		prisma.expense.count({ where: { budgetPlanId: planId } }),
		prisma.income.count({ where: { budgetPlanId: planId } }),
		prisma.debt.count({ where: { budgetPlanId: planId } }),
		prisma.goal.count({ where: { budgetPlanId: planId } }),
	]);

	return {
		plan: { id: plan.id, name: plan.name, kind: plan.kind },
		counts: { categories, expenses, income, debts, goals },
	};
}

export async function saveSettingsAction(formData: FormData): Promise<void> {
	const session = await getServerSession(authOptions);
	const sessionUser = session?.user;
	const sessionUsername = sessionUser?.username ?? sessionUser?.name;
	if (!sessionUser || !sessionUsername) {
		throw new Error("Not authenticated");
	}

	const budgetPlanId = String(formData.get("budgetPlanId") || "").trim();
	if (!budgetPlanId) {
		throw new Error("Missing budgetPlanId");
	}

	const userId = await resolveUserId({ userId: sessionUser.id, username: sessionUsername });
	const plan = await prisma.budgetPlan.findUnique({
		where: { id: budgetPlanId },
		select: { userId: true },
	});
	if (!plan || plan.userId !== userId) {
		throw new Error("Budget plan not found or unauthorized");
	}

	const updates: any = {};

	if (formData.has("budgetHorizonYears")) {
		const allowed = new Set([2, 5, 10, 15, 20, 25, 30]);
		const raw = Number(formData.get("budgetHorizonYears"));
		const value = Number.isFinite(raw) ? Math.floor(raw) : NaN;
		if (!allowed.has(value)) {
			throw new Error("Invalid budget horizon years");
		}
		updates.budgetHorizonYears = value;
	}

	if (formData.has("payDate")) {
		const raw = Number(formData.get("payDate"));
		updates.payDate = Number.isFinite(raw) ? Math.max(1, Math.min(31, raw)) : 27;
	}

	if (formData.has("monthlyAllowance")) {
		const raw = Number(formData.get("monthlyAllowance"));
		updates.monthlyAllowance = Number.isFinite(raw) ? raw : 0;
	}

	if (formData.has("savingsBalance")) {
		const raw = Number(formData.get("savingsBalance"));
		updates.savingsBalance = Number.isFinite(raw) ? raw : 0;
	}

	if (formData.has("emergencyBalance")) {
		const raw = Number(formData.get("emergencyBalance"));
		updates.emergencyBalance = Number.isFinite(raw) ? raw : 0;
	}

	if (formData.has("monthlySavingsContribution")) {
		const raw = Number(formData.get("monthlySavingsContribution"));
		updates.monthlySavingsContribution = Number.isFinite(raw) ? raw : 0;
	}

	if (formData.has("monthlyInvestmentContribution")) {
		const raw = Number(formData.get("monthlyInvestmentContribution"));
		updates.monthlyInvestmentContribution = Number.isFinite(raw) ? raw : 0;
	}

	if (formData.has("budgetStrategy")) {
		const value = String(formData.get("budgetStrategy") || "").trim();
		if (value === "zeroBased" || value === "fiftyThirtyTwenty" || value === "payYourselfFirst") {
			updates.budgetStrategy = value;
		}
	}

	if (formData.has("country")) {
		updates.country = String(formData.get("country") || "GB").trim();
	}

	if (formData.has("language")) {
		updates.language = String(formData.get("language") || "en").trim();
	}

	if (formData.has("currency")) {
		updates.currency = String(formData.get("currency") || "GBP").trim();
	}

	await saveSettings(budgetPlanId, updates);
	revalidatePath(`/user=${encodeURIComponent(sessionUsername)}/${encodeURIComponent(budgetPlanId)}/settings`);
}

export async function updateUserDetailsAction(formData: FormData): Promise<void> {
	const session = await getServerSession(authOptions);
	const sessionUser = session?.user;
	const sessionUsername = sessionUser?.username ?? sessionUser?.name;
	if (!sessionUser?.id || !sessionUsername) {
		throw new Error("Not authenticated");
	}

	const budgetPlanId = String(formData.get("budgetPlanId") || "").trim();
	if (!budgetPlanId) {
		throw new Error("Missing budgetPlanId");
	}

	// Verify user owns this budget plan
	const userId = await resolveUserId({ userId: sessionUser.id, username: sessionUsername });
	const plan = await prisma.budgetPlan.findUnique({
		where: { id: budgetPlanId },
		select: { userId: true },
	});
	if (!plan || plan.userId !== userId) {
		throw new Error("Budget plan not found or unauthorized");
	}

	const userUpdates: any = {};
	const settingsUpdates: any = {};

	if (formData.has("email")) {
		const email = String(formData.get("email") || "").trim();
		if (email) userUpdates.email = email;
	}

	if (formData.has("country")) {
		const country = String(formData.get("country") || "GB").trim();
		settingsUpdates.country = country;
	}

	if (Object.keys(userUpdates).length > 0) {
		await prisma.user.update({
			where: { id: sessionUser.id },
			data: userUpdates,
		});
	}

	if (Object.keys(settingsUpdates).length > 0) {
		await saveSettings(budgetPlanId, settingsUpdates);
	}

	revalidatePath(`/user=${encodeURIComponent(sessionUsername)}/${encodeURIComponent(budgetPlanId)}/settings`);
}

function decimalToNumber(value: unknown): number {
	if (value == null) return 0;
	if (typeof value === "number") return Number.isFinite(value) ? value : 0;
	const n = Number((value as any)?.toString?.() ?? value);
	return Number.isFinite(n) ? n : 0;
}

export async function applyFiftyThirtyTwentyTargetsAction(formData: FormData): Promise<void> {
	const session = await getServerSession(authOptions);
	const sessionUser = session?.user;
	const sessionUsername = sessionUser?.username ?? sessionUser?.name;
	if (!sessionUser || !sessionUsername) {
		throw new Error("Not authenticated");
	}

	const budgetPlanId = String(formData.get("budgetPlanId") || "").trim();
	if (!budgetPlanId) throw new Error("Missing budgetPlanId");

	const rawMonth = String(formData.get("month") || "").trim();
	if (!isMonthKey(rawMonth)) throw new Error("Invalid month");

	const rawYear = Number(formData.get("year"));
	const year = Number.isFinite(rawYear) && rawYear > 2000 && rawYear < 3000 ? Math.floor(rawYear) : new Date().getFullYear();

	const userId = await resolveUserId({ userId: sessionUser.id, username: sessionUsername });
	const plan = await prisma.budgetPlan.findUnique({ where: { id: budgetPlanId }, select: { userId: true } });
	if (!plan || plan.userId !== userId) {
		throw new Error("Budget plan not found or unauthorized");
	}

	const monthKey = rawMonth as any;
	const monthNum = monthKeyToNumber(monthKey);

	// Recompute on server (avoid trusting client-provided income totals).
	const summary = await getZeroBasedSummary(budgetPlanId, monthKey, { year });
	const incomeTotal = Number.isFinite(summary.incomeTotal) ? summary.incomeTotal : 0;

	// Use planned debt plan (not just recorded payments) so the targets stay stable.
	const debts = await prisma.debt.findMany({
		where: {
			budgetPlanId,
			currentBalance: { gt: 0 },
			OR: [{ sourceType: null }, { sourceType: { not: "expense" } }],
		},
		select: { amount: true },
	});
	const plannedDebtPayments = debts.reduce((sum, d) => sum + decimalToNumber(d.amount), 0);

	const wantsTarget = incomeTotal * 0.3;
	const savingsDebtTarget = incomeTotal * 0.2;
	const targetIncomeSacrifice = Math.max(0, savingsDebtTarget - plannedDebtPayments);

	const currentAlloc = await getMonthlyAllocationSnapshot(budgetPlanId, monthKey, { year });
	const keepEmergency = currentAlloc.monthlyEmergencyContribution ?? 0;
	const keepInvestments = currentAlloc.monthlyInvestmentContribution ?? 0;
	const nextSavings = Math.max(0, targetIncomeSacrifice - keepEmergency - keepInvestments);

	await upsertMonthlyAllocation(budgetPlanId, year, monthNum, {
		monthlyAllowance: wantsTarget,
		monthlySavingsContribution: nextSavings,
		monthlyEmergencyContribution: keepEmergency,
		monthlyInvestmentContribution: keepInvestments,
	});

	const settingsPath = `/user=${encodeURIComponent(sessionUsername)}/${encodeURIComponent(budgetPlanId)}/settings`;
	const incomePath = `/user=${encodeURIComponent(sessionUsername)}/${encodeURIComponent(budgetPlanId)}/income`;

	revalidatePath(settingsPath);
	revalidatePath(incomePath);
	revalidatePath("/");
	revalidatePath("/dashboard");
	revalidatePath("/admin/income");
	revalidatePath("/admin/settings");

	redirect(`${settingsPath}?month=${encodeURIComponent(String(rawMonth))}&applied=${encodeURIComponent("503020")}`);
}

export async function deleteBudgetPlanAction(
	budgetPlanId: string,
	confirmation: string
): Promise<{ redirectTo: string }> {
	const session = await getServerSession(authOptions);
	const sessionUser = session?.user;
	const sessionUsername = sessionUser?.username ?? sessionUser?.name;
	if (!sessionUser || !sessionUsername) {
		throw new Error("Not authenticated");
	}

	const planId = String(budgetPlanId ?? "").trim();
	if (!planId) throw new Error("Missing budgetPlanId");

	if (String(confirmation ?? "").trim() !== "DELETE") {
		throw new Error("Confirmation required");
	}

	const userId = await resolveUserId({ userId: sessionUser.id, username: sessionUsername });
	const plan = await prisma.budgetPlan.findUnique({
		where: { id: planId },
		select: { id: true, userId: true, kind: true },
	});
	if (!plan || plan.userId !== userId) {
		throw new Error("Budget plan not found");
	}

	if (String(plan.kind).toLowerCase() === "personal") {
		throw new Error("Personal plans cannot be deleted");
	}

	await prisma.budgetPlan.delete({ where: { id: planId } });
	await fs.rm(getBudgetDataDir(planId), { recursive: true, force: true });

	const fallback = await prisma.budgetPlan.findFirst({
		where: { userId },
		orderBy: { createdAt: "desc" },
		select: { id: true },
	});

	return {
		redirectTo: fallback
			? `/user=${encodeURIComponent(sessionUsername)}/${encodeURIComponent(fallback.id)}`
			: "/budgets/new",
	};
}

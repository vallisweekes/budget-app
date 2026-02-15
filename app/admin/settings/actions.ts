"use server";

import { getSettings, saveSettings } from "@/lib/settings/store";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { resolveUserId } from "@/lib/budgetPlans";
import { prisma } from "@/lib/prisma";
import fs from "node:fs/promises";
import { getBudgetDataDir } from "@/lib/storage/budgetDataPath";
import { revalidatePath } from "next/cache";

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
		select: { id: true, userId: true },
	});
	if (!plan || plan.userId !== userId) {
		throw new Error("Budget plan not found");
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

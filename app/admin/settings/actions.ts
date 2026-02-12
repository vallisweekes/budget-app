"use server";

import { getSettings, saveSettings } from "@/lib/settings/store";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { resolveUserId } from "@/lib/budgetPlans";
import { prisma } from "@/lib/prisma";
import fs from "node:fs/promises";
import { getBudgetDataDir } from "@/lib/storage/budgetDataPath";

export async function saveSettingsAction(formData: FormData): Promise<void> {
	const current = await getSettings();

	const next = { ...current };

	if (formData.has("payDate")) {
		const raw = Number(formData.get("payDate"));
		const payDate = Number.isFinite(raw) ? raw : 27;
		next.payDate = Math.max(1, Math.min(31, payDate));
	}

	if (formData.has("monthlyAllowance")) {
		const raw = Number(formData.get("monthlyAllowance"));
		next.monthlyAllowance = Number.isFinite(raw) ? raw : 0;
	}

	if (formData.has("savingsBalance")) {
		const raw = Number(formData.get("savingsBalance"));
		next.savingsBalance = Number.isFinite(raw) ? raw : 0;
	}

	if (formData.has("monthlySavingsContribution")) {
		const raw = Number(formData.get("monthlySavingsContribution"));
		next.monthlySavingsContribution = Number.isFinite(raw) ? raw : 0;
	}

	if (formData.has("monthlyInvestmentContribution")) {
		const raw = Number(formData.get("monthlyInvestmentContribution"));
		next.monthlyInvestmentContribution = Number.isFinite(raw) ? raw : 0;
	}

	if (formData.has("budgetStrategy")) {
		const value = String(formData.get("budgetStrategy") || "").trim();
		next.budgetStrategy =
			value === "zeroBased" || value === "fiftyThirtyTwenty" || value === "payYourselfFirst"
				? value
				: undefined;
	}

	await saveSettings(next);
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

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { addOrUpdateIncomeAcrossMonths, updateIncome, removeIncome, resolveIncomeYear } from "@/lib/income/store";
import { MONTHS } from "@/lib/constants/time";
import type { MonthKey } from "@/types";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveUserId } from "@/lib/budgetPlans";
import { monthKeyToNumber, normalizeMonthKey } from "@/lib/helpers/monthKey";
import { getSettings } from "@/lib/settings/store";
import {
	createAllocationDefinition,
	listAllocationDefinitions,
	removeAllMonthlyCustomAllocationOverrides,
	removeMonthlyAllocationOverride,
	resolveActiveBudgetYear,
	upsertMonthlyAllocation,
	upsertMonthlyCustomAllocationOverrides,
} from "@/lib/allocations/store";
import { isMonthKey } from "@/lib/budget/zero-based";
import { currentMonthKey } from "@/lib/helpers/monthKey";

function isPastMonth(month: MonthKey, year?: number, now: Date = new Date()): boolean {
	const currentYear = now.getFullYear();
	if (typeof year === "number" && Number.isFinite(year)) {
		if (year < currentYear) return true;
		if (year > currentYear) return false;
	}
	const current = currentMonthKey(now);
	return monthKeyToNumber(month) < monthKeyToNumber(current);
}

function isTruthyFormValue(value: FormDataEntryValue | null): boolean {
	if (value == null) return false;
	const v = String(value).trim().toLowerCase();
	return v === "1" || v === "true" || v === "on" || v === "yes";
}

function buildAllowedBudgetYears(horizonYears: number, nowYear: number): number[] {
	const safeHorizon = Number.isFinite(horizonYears) && horizonYears > 0 ? Math.floor(horizonYears) : 10;
	return Array.from({ length: safeHorizon }, (_, i) => nowYear + i);
}

async function requireYearWithinBudgetHorizon(budgetPlanId: string, year: number): Promise<void> {
	const settings = await getSettings(budgetPlanId);
	const nowYear = new Date().getFullYear();
	const allowedYears = buildAllowedBudgetYears(settings.budgetHorizonYears ?? 10, nowYear);
	if (!allowedYears.includes(year)) {
		throw new Error(`Year ${year} is outside your budget horizon.`);
	}
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

async function filterMonthsWithoutAnyIncome(budgetPlanId: string, year: number, months: MonthKey[]): Promise<MonthKey[]> {
	if (months.length === 0) return [];
	const monthNumbers = months.map((m) => monthKeyToNumber(m));
	const existing = await prisma.income.findMany({
		where: { budgetPlanId, year, month: { in: monthNumbers } },
		distinct: ["month"],
		select: { month: true },
	});
	const existingSet = new Set(existing.map((r) => r.month));
	return months.filter((m) => !existingSet.has(monthKeyToNumber(m)));
}

function requireBudgetPlanId(formData: FormData): string {
	const raw = formData.get("budgetPlanId");
	const budgetPlanId = String(raw ?? "").trim();
	if (!budgetPlanId) throw new Error("Missing budgetPlanId");
	return budgetPlanId;
}

export async function addIncomeAction(formData: FormData): Promise<void> {
	const budgetPlanId = requireBudgetPlanId(formData);
	const rawMonth = String(formData.get("month") ?? "").trim();
	const normalizedMonth = normalizeMonthKey(rawMonth) ?? (isMonthKey(rawMonth) ? (rawMonth as MonthKey) : null);
	if (!normalizedMonth) throw new Error("Invalid month");
	const month = normalizedMonth;
	const yearRaw = Number(formData.get("year"));
	const year = Number.isFinite(yearRaw) ? yearRaw : await resolveIncomeYear(budgetPlanId);
	const name = String(formData.get("name") || "").trim();
	const amount = Number(formData.get("amount") || 0);
	if (!name || !month) return;

	const distributeMonths = isTruthyFormValue(formData.get("distributeMonths"));
	const distributeYears = isTruthyFormValue(formData.get("distributeYears"));

	const { userId, sessionUsername } = await requireAuthenticatedUser();
	await requireOwnedBudgetPlan(budgetPlanId, userId);
	await requireYearWithinBudgetHorizon(budgetPlanId, year);

	const rawTargetMonths: MonthKey[] = distributeMonths ? (MONTHS as MonthKey[]) : [month];
	const targetMonths: MonthKey[] = rawTargetMonths.filter((m) => !isPastMonth(m, year));
	if (targetMonths.length === 0) return;
	const sharedId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

	if (distributeYears) {
		const plans = await prisma.budgetPlan.findMany({ where: { userId }, select: { id: true } });
		for (const p of plans) {
			try {
				await requireYearWithinBudgetHorizon(p.id, year);
			} catch {
				continue;
			}
			await addOrUpdateIncomeAcrossMonths(p.id, targetMonths, { id: sharedId, name, amount }, year);
			if (sessionUsername) revalidateUserScopedBudgetPaths(sessionUsername, p.id);
		}
		revalidatePath("/");
		revalidatePath("/admin/income");
		return;
	}

	await addOrUpdateIncomeAcrossMonths(budgetPlanId, targetMonths, { id: sharedId, name, amount }, year);
	if (sessionUsername) revalidateUserScopedBudgetPaths(sessionUsername, budgetPlanId);
	revalidatePath("/");
	revalidatePath("/admin/income");
}

export async function updateIncomeItemAction(
	budgetPlanId: string,
	year: number,
	month: MonthKey,
	id: string,
	name: string,
	amount: number
): Promise<void> {
	if (!name.trim()) return;
	if (isPastMonth(month, year)) return;
	try {
		await requireYearWithinBudgetHorizon(budgetPlanId, year);
	} catch {
		return;
	}
	const { userId, sessionUsername } = await requireAuthenticatedUser();
	await requireOwnedBudgetPlan(budgetPlanId, userId);
	await updateIncome(budgetPlanId, month, id, { name: name.trim(), amount }, year);
	if (sessionUsername) revalidateUserScopedBudgetPaths(sessionUsername, budgetPlanId);
	revalidatePath("/");
	revalidatePath("/admin/income");
}

export async function removeIncomeAction(budgetPlanId: string, year: number, month: MonthKey, id: string): Promise<void> {
	if (isPastMonth(month, year)) return;
	try {
		await requireYearWithinBudgetHorizon(budgetPlanId, year);
	} catch {
		return;
	}
	const { userId, sessionUsername } = await requireAuthenticatedUser();
	await requireOwnedBudgetPlan(budgetPlanId, userId);
	await removeIncome(budgetPlanId, month, id, year);
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

	// Custom allocations
	const amountsByAllocationId: Record<string, number> = {};
	for (const [key, value] of formData.entries()) {
		if (!key.startsWith("customAllocation:")) continue;
		const allocationId = key.slice("customAllocation:".length).trim();
		if (!allocationId) continue;
		const amount = Number(value);
		amountsByAllocationId[allocationId] = Number.isFinite(amount) ? amount : 0;
	}

	const newName = String(formData.get("newCustomAllocationName") ?? "").trim();
	const normalizedNewName = newName.replace(/\s+/g, " ").trim().toLowerCase();
	const newAmountRaw = Number(formData.get("newCustomAllocationAmount") ?? 0);
	const newAmount = Number.isFinite(newAmountRaw) ? newAmountRaw : 0;
	if (newName) {
		// Treat the provided amount as the default amount for the new allocation.
		// If the user only meant it for this month, they can change other months later.
		let allocationId: string | null = null;
		try {
			const created = await createAllocationDefinition({
				budgetPlanId,
				name: newName,
				defaultAmount: newAmount,
			});
			allocationId = created.id;
		} catch {
			// Likely a duplicate name; reuse the existing definition.
			const defs = await listAllocationDefinitions(budgetPlanId);
			const existing = defs.find((d) => d.name.replace(/\s+/g, " ").trim().toLowerCase() === normalizedNewName);
			allocationId = existing?.id ?? null;
		}

		if (allocationId) {
			amountsByAllocationId[allocationId] = newAmount;
		}
	}

	await upsertMonthlyCustomAllocationOverrides({
		budgetPlanId,
		year,
		month,
		amountsByAllocationId,
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

export async function resetAllocationsToPlanDefaultAction(formData: FormData): Promise<void> {
	const budgetPlanId = requireBudgetPlanId(formData);
	const { userId } = await requireAuthenticatedUser();
	await requireOwnedBudgetPlan(budgetPlanId, userId);

	const rawMonth = String(formData.get("month") ?? "").trim();
	if (!isMonthKey(rawMonth)) {
		throw new Error("Invalid allocation month");
	}
	const monthKey = rawMonth as MonthKey;
	if (isPastMonth(monthKey)) return;

	const month = monthKeyToNumber(monthKey);
	const year = await resolveActiveBudgetYear(budgetPlanId);

	await removeMonthlyAllocationOverride({ budgetPlanId, year, month });
	await removeAllMonthlyCustomAllocationOverrides({ budgetPlanId, year, month });

	const session = await getServerSession(authOptions);
	const sessionUser = session?.user;
	const sessionUsername = sessionUser?.username ?? sessionUser?.name;
	if (sessionUsername) {
		const incomePath = `/user=${encodeURIComponent(sessionUsername)}/${encodeURIComponent(budgetPlanId)}/income`;
		revalidatePath(incomePath);
		revalidatePath("/");
		revalidatePath("/admin/income");
		redirect(
			`${incomePath}?month=${encodeURIComponent(monthKey)}&saved=${encodeURIComponent("allocationsReset")}`
		);
	}

	revalidatePath("/");
	revalidatePath("/admin/income");
}

export async function createCustomAllowanceAction(formData: FormData): Promise<void> {
	const budgetPlanId = requireBudgetPlanId(formData);
	const { userId } = await requireAuthenticatedUser();
	await requireOwnedBudgetPlan(budgetPlanId, userId);

	const rawMonth = String(formData.get("month") ?? "").trim();
	if (!isMonthKey(rawMonth)) {
		throw new Error("Invalid allocation month");
	}
	const monthKey = rawMonth as MonthKey;
	if (isPastMonth(monthKey)) return;

	const name = String(formData.get("name") ?? "").trim();
	const defaultAmountRaw = Number(formData.get("defaultAmount") ?? 0);
	const defaultAmount = Number.isFinite(defaultAmountRaw) ? defaultAmountRaw : 0;
	if (!name) return;

	await createAllocationDefinition({ budgetPlanId, name, defaultAmount });

	const session = await getServerSession(authOptions);
	const sessionUser = session?.user;
	const sessionUsername = sessionUser?.username ?? sessionUser?.name;
	if (sessionUsername) {
		const incomePath = `/user=${encodeURIComponent(sessionUsername)}/${encodeURIComponent(budgetPlanId)}/income`;
		revalidatePath(incomePath);
		revalidatePath("/");
		revalidatePath("/admin/income");
		redirect(
			`${incomePath}?tab=allocations&month=${encodeURIComponent(monthKey)}&saved=${encodeURIComponent(
				"allowanceCreated"
			)}`
		);
	}

	revalidatePath("/");
	revalidatePath("/admin/income");
}

import { NextResponse, type NextRequest } from "next/server";
import { getSessionUserId, resolveOwnedBudgetPlanId } from "@/lib/api/bffAuth";
import { resolveUserPayPeriodContext } from "@/lib/api/payPeriodContext";
import {
	getMonthlyAllocationSnapshot,
	getMonthlyCustomAllocationsSnapshot,
	resolveActiveBudgetYear,
	upsertMonthlyAllocation,
	upsertMonthlyCustomAllocationOverrides,
} from "@/lib/allocations/store";
import {
	ensureLegacyCustomSacrificesHaveGoals,
	getPlannedAmountForTarget,
	listSacrificeGoalLinks,
	listSacrificeTransferConfirmations,
} from "@/lib/income-sacrifice/goalLinks";
import { monthNumberToKey } from "@/lib/helpers/monthKey";
import { getAiIncomeSacrificeTips } from "@/lib/ai/incomeSacrificeTips";
import { prisma } from "@/lib/prisma";
import type { MonthKey } from "@/types";

export const runtime = "nodejs";

function toMoney(value: unknown): number {
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : 0;
}

function unauthorized() {
	return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
}

export async function GET(request: NextRequest) {
	try {
		const userId = await getSessionUserId(request);
		if (!userId) return unauthorized();

		const { searchParams } = new URL(request.url);
		const budgetPlanId = await resolveOwnedBudgetPlanId({
			userId,
			budgetPlanId: searchParams.get("budgetPlanId"),
		});
		if (!budgetPlanId) return NextResponse.json({ error: "Budget plan not found" }, { status: 404 });

		const { month, year } = await resolveUserPayPeriodContext({
			userId,
			budgetPlanId,
			requestedMonth: searchParams.get("month"),
			requestedYear: searchParams.get("year"),
		});
		await ensureLegacyCustomSacrificesHaveGoals(budgetPlanId);
		const monthKey = monthNumberToKey(month as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12) as MonthKey;
		const allocation = await getMonthlyAllocationSnapshot(budgetPlanId, monthKey, {
			year,
			fallbackToPlanDefaults: false,
		});
		const custom = await getMonthlyCustomAllocationsSnapshot(budgetPlanId, monthKey, {
			year,
			fallbackToDefinitionDefaults: false,
		});
		const plan = await prisma.budgetPlan.findUnique({
			where: { id: budgetPlanId },
			select: {
				language: true,
				savingsBalance: true,
				emergencyBalance: true,
				investmentBalance: true,
			},
		});
		const sacrificeLanguage = plan?.language ?? "en";

		const fixed = {
			monthlyAllowance: toMoney(allocation.monthlyAllowance),
			monthlySavingsContribution: toMoney(allocation.monthlySavingsContribution),
			monthlyEmergencyContribution: toMoney(allocation.monthlyEmergencyContribution),
			monthlyInvestmentContribution: toMoney(allocation.monthlyInvestmentContribution),
		};
		const baseBalances = {
			savings: toMoney(plan?.savingsBalance),
			emergency: toMoney(plan?.emergencyBalance),
			investment: toMoney(plan?.investmentBalance),
		};
		const fixedTotal =
			fixed.monthlyAllowance +
			fixed.monthlySavingsContribution +
			fixed.monthlyEmergencyContribution +
			fixed.monthlyInvestmentContribution;

		const [goals, goalLinks, confirmations] = await Promise.all([
			prisma.goal.findMany({
				where: { budgetPlanId },
				orderBy: [{ createdAt: "desc" }],
				select: {
					id: true,
					title: true,
					category: true,
					targetAmount: true,
					currentAmount: true,
				},
			}),
			listSacrificeGoalLinks(budgetPlanId),
			listSacrificeTransferConfirmations({ budgetPlanId, year, month }),
		]);

		const plannedByTarget = await Promise.all(
			goalLinks.map(async (link) => ({
				targetKey: link.targetKey,
				amount: await getPlannedAmountForTarget({
					budgetPlanId,
					year,
					month,
					targetKey: link.targetKey,
				}),
			}))
		);
		const linkedPlannedTotal = plannedByTarget.reduce((sum, row) => sum + Number(row.amount ?? 0), 0);
		const linkedTransferredTotal = confirmations.reduce((sum, row) => sum + Number(row.amount ?? 0), 0);
		const tips = await getAiIncomeSacrificeTips({
			cacheKey: `income-sacrifice:${budgetPlanId}:${year}-${month}:${Math.round(fixedTotal * 100)}:${Math.round(Number(custom.total ?? 0) * 100)}:${goalLinks.length}:${Math.round(linkedPlannedTotal * 100)}:${Math.round(linkedTransferredTotal * 100)}:${sacrificeLanguage}`,
			now: new Date(),
			language: sacrificeLanguage,
			context: {
				month,
				year,
				totalSacrifice: fixedTotal + Number(custom.total ?? 0),
				fixed,
				customItems: (custom.items ?? []).map((item) => ({
					name: String(item?.name ?? "").trim(),
					amount: Number(item?.amount ?? 0),
				})),
				goalLinks: goalLinks.map((link) => ({ goalTitle: link.goalTitle, targetKey: link.targetKey })),
				pendingTransferTotal: Math.max(0, linkedPlannedTotal - linkedTransferredTotal),
				transferredTotal: linkedTransferredTotal,
				plannedTotal: linkedPlannedTotal,
			},
			maxTips: 4,
		});

		return NextResponse.json({
			budgetPlanId,
			year,
			month,
			fixed,
			baseBalances,
			customItems: custom.items,
			customTotal: toMoney(custom.total),
			totalSacrifice: fixedTotal + toMoney(custom.total),
			goals,
			goalLinks,
			confirmations,
			tips,
			linkedTotals: {
				planned: linkedPlannedTotal,
				transferred: linkedTransferredTotal,
				pending: Math.max(0, linkedPlannedTotal - linkedTransferredTotal),
			},
		});
	} catch (error) {
		console.error("[bff/income-sacrifice] GET error", error);
		return NextResponse.json({ error: "Failed to load income sacrifice" }, { status: 500 });
	}
}

export async function PATCH(request: NextRequest) {
	try {
		const userId = await getSessionUserId(request);
		if (!userId) return unauthorized();

		const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
		if (!body || typeof body !== "object") {
			return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
		}

		const budgetPlanId = await resolveOwnedBudgetPlanId({
			userId,
			budgetPlanId: typeof body.budgetPlanId === "string" ? body.budgetPlanId : null,
		});
		if (!budgetPlanId) return NextResponse.json({ error: "Budget plan not found" }, { status: 404 });

		const { month, year } = await resolveUserPayPeriodContext({
			userId,
			budgetPlanId,
			requestedMonth: body.month,
			requestedYear: body.year,
			now: new Date(),
		});
		const parsedTargets = Array.isArray(body.targets)
			? body.targets
					.map((row) => {
						if (!row || typeof row !== "object") return null;
						const parsedMonth = Math.floor(Number((row as Record<string, unknown>).month));
						const parsedYear = Math.floor(Number((row as Record<string, unknown>).year));
						if (!Number.isFinite(parsedMonth) || parsedMonth < 1 || parsedMonth > 12) return null;
						if (!Number.isFinite(parsedYear) || parsedYear < 1900 || parsedYear > 3000) return null;
						return { month: parsedMonth, year: parsedYear };
					})
					.filter((row): row is { month: number; year: number } => Boolean(row))
			: [];
		const targets = parsedTargets.length > 0 ? parsedTargets : [{ month, year }];
		const dedupedTargets = Array.from(new Map(targets.map((target) => [`${target.year}-${target.month}`, target])).values());

		const fixed = body.fixed && typeof body.fixed === "object" ? (body.fixed as Record<string, unknown>) : null;
		const rawFixedFieldUpdate =
			body.fixedFieldUpdate && typeof body.fixedFieldUpdate === "object"
				? (body.fixedFieldUpdate as Record<string, unknown>)
				: null;
		const fixedField = String(rawFixedFieldUpdate?.field ?? "");
		const hasFixedFieldUpdate =
			fixedField === "monthlyAllowance"
			|| fixedField === "monthlySavingsContribution"
			|| fixedField === "monthlyEmergencyContribution"
			|| fixedField === "monthlyInvestmentContribution";

		if (hasFixedFieldUpdate) {
			const amount = toMoney(rawFixedFieldUpdate?.amount);
			for (const target of dedupedTargets) {
				const monthKey = monthNumberToKey(
					target.month as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12
				) as MonthKey;
				const snapshot = await getMonthlyAllocationSnapshot(budgetPlanId, monthKey, { year: target.year });
				const nextFixed = {
					monthlyAllowance: toMoney(snapshot.monthlyAllowance),
					monthlySavingsContribution: toMoney(snapshot.monthlySavingsContribution),
					monthlyEmergencyContribution: toMoney(snapshot.monthlyEmergencyContribution),
					monthlyInvestmentContribution: toMoney(snapshot.monthlyInvestmentContribution),
				};
				(nextFixed as Record<string, number>)[fixedField] = amount;
				await upsertMonthlyAllocation(budgetPlanId, target.year, target.month, nextFixed);
			}
		} else if (fixed) {
			const nextFixed = {
				monthlyAllowance: toMoney(fixed.monthlyAllowance),
				monthlySavingsContribution: toMoney(fixed.monthlySavingsContribution),
				monthlyEmergencyContribution: toMoney(fixed.monthlyEmergencyContribution),
				monthlyInvestmentContribution: toMoney(fixed.monthlyInvestmentContribution),
			};
			for (const target of dedupedTargets) {
				await upsertMonthlyAllocation(budgetPlanId, target.year, target.month, nextFixed);
			}
		}

		const customAmountById: Record<string, number> = {};
		const rawCustom = body.customAmountById;
		if (rawCustom && typeof rawCustom === "object") {
			for (const [id, value] of Object.entries(rawCustom as Record<string, unknown>)) {
				if (!id.trim()) continue;
				customAmountById[id] = toMoney(value);
			}
		}
		if (Object.keys(customAmountById).length > 0) {
			for (const target of dedupedTargets) {
				await upsertMonthlyCustomAllocationOverrides({
					budgetPlanId,
					year: target.year,
					month: target.month,
					amountsByAllocationId: customAmountById,
				});
			}
		}

		return NextResponse.json({ success: true, updatedMonths: dedupedTargets.length });
	} catch (error) {
		console.error("[bff/income-sacrifice] PATCH error", error);
		return NextResponse.json({ error: "Failed to save income sacrifice" }, { status: 500 });
	}
}

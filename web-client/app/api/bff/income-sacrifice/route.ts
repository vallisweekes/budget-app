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

async function syncSettingsFixedAllocations(args: {
	budgetPlanId: string;
	fixed: {
		monthlyAllowance: number;
		monthlySavingsContribution: number;
		monthlyEmergencyContribution: number;
		monthlyInvestmentContribution: number;
	};
}) {
	const updateData = {
		monthlyAllowance: args.fixed.monthlyAllowance,
		monthlySavingsContribution: args.fixed.monthlySavingsContribution,
		monthlyEmergencyContribution: args.fixed.monthlyEmergencyContribution,
		monthlyInvestmentContribution: args.fixed.monthlyInvestmentContribution,
	};

	try {
		await prisma.budgetPlan.update({
			where: { id: args.budgetPlanId },
			data: updateData,
			select: { id: true },
		});
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		const unknownMonthlyEmergency =
			message.includes("Unknown field `monthlyEmergencyContribution`") ||
			message.includes("Unknown argument `monthlyEmergencyContribution`");
		if (!unknownMonthlyEmergency) throw error;

		const { monthlyEmergencyContribution: _unusedMonthlyEmergencyContribution, ...fallbackUpdateData } = updateData;
		await prisma.budgetPlan.update({
			where: { id: args.budgetPlanId },
			data: fallbackUpdateData,
			select: { id: true },
		});
	}
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
		const allocation = await getMonthlyAllocationSnapshot(budgetPlanId, monthKey, { year });
		const custom = await getMonthlyCustomAllocationsSnapshot(budgetPlanId, monthKey, { year });
		const plan = await prisma.budgetPlan.findUnique({
			where: { id: budgetPlanId },
			select: {
				savingsBalance: true,
				emergencyBalance: true,
				investmentBalance: true,
			},
		});

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
			cacheKey: `income-sacrifice:${budgetPlanId}:${year}-${month}:${Math.round(fixedTotal * 100)}:${Math.round(Number(custom.total ?? 0) * 100)}:${goalLinks.length}:${Math.round(linkedPlannedTotal * 100)}:${Math.round(linkedTransferredTotal * 100)}`,
			now: new Date(),
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
		const fallbackYear = await resolveActiveBudgetYear(budgetPlanId);
		const safeYear = Number.isFinite(Number(body.year)) ? year : fallbackYear;

		const fixed = body.fixed && typeof body.fixed === "object" ? (body.fixed as Record<string, unknown>) : {};
		const nextFixed = {
			monthlyAllowance: toMoney(fixed.monthlyAllowance),
			monthlySavingsContribution: toMoney(fixed.monthlySavingsContribution),
			monthlyEmergencyContribution: toMoney(fixed.monthlyEmergencyContribution),
			monthlyInvestmentContribution: toMoney(fixed.monthlyInvestmentContribution),
		};
		await upsertMonthlyAllocation(budgetPlanId, safeYear, month, {
			monthlyAllowance: nextFixed.monthlyAllowance,
			monthlySavingsContribution: nextFixed.monthlySavingsContribution,
			monthlyEmergencyContribution: nextFixed.monthlyEmergencyContribution,
			monthlyInvestmentContribution: nextFixed.monthlyInvestmentContribution,
		});

		const activePeriod = await resolveUserPayPeriodContext({
			userId,
			budgetPlanId,
			now: new Date(),
		});
		if (activePeriod.month === month && activePeriod.year === year) {
			await syncSettingsFixedAllocations({
				budgetPlanId,
				fixed: nextFixed,
			});
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
			await upsertMonthlyCustomAllocationOverrides({
				budgetPlanId,
				year: safeYear,
				month,
				amountsByAllocationId: customAmountById,
			});
		}

		return NextResponse.json({ success: true });
	} catch (error) {
		console.error("[bff/income-sacrifice] PATCH error", error);
		return NextResponse.json({ error: "Failed to save income sacrifice" }, { status: 500 });
	}
}

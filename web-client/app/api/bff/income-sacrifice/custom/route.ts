import { NextResponse, type NextRequest } from "next/server";
import { getSessionUserId, resolveOwnedBudgetPlanId } from "@/lib/api/bffAuth";
import { createAllocationDefinition, resolveActiveBudgetYear, upsertMonthlyCustomAllocationOverrides } from "@/lib/allocations/store";
import { invalidateDashboardCache } from "@/lib/cache/dashboardCache";
import { upsertSacrificeGoalLink } from "@/lib/income-sacrifice/goalLinks";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

function unauthorized() {
	return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
}

const TYPE_LABELS: Record<string, string> = {
	allowance: "Monthly allowance",
	savings: "Savings",
	emergency: "Emergency fund",
	investment: "Investments",
	custom: "Custom",
};

export async function POST(request: NextRequest) {
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

		const type = String(body.type ?? "custom").trim().toLowerCase();
		const rawName = String(body.name ?? "").trim();
		if (type === "custom" && !rawName) {
			return NextResponse.json({ error: "Name is required for custom sacrifice" }, { status: 400 });
		}

		const amountRaw = Number(body.amount ?? 0);
		const amount = Number.isFinite(amountRaw) ? amountRaw : 0;
		const createGoal = body.createGoal === true;
		const goalTargetAmountRaw = Number(body.goalTargetAmount ?? Number.NaN);
		const goalTargetAmount = Number.isFinite(goalTargetAmountRaw) ? goalTargetAmountRaw : Number.NaN;
		const goalTargetYearRaw = Number(body.goalTargetYear ?? Number.NaN);
		const goalTargetYear = Number.isFinite(goalTargetYearRaw) ? Math.floor(goalTargetYearRaw) : Number.NaN;
		const monthRaw = Number(body.month);
		const month = Number.isFinite(monthRaw) && monthRaw >= 1 && monthRaw <= 12 ? monthRaw : new Date().getMonth() + 1;
		const yearRaw = Number(body.year);
		const year = Number.isFinite(yearRaw) ? yearRaw : await resolveActiveBudgetYear(budgetPlanId);

		if (createGoal) {
			if (type !== "custom") {
				return NextResponse.json({ error: "Only custom sacrifices can create linked goals" }, { status: 400 });
			}
			if (!rawName) {
				return NextResponse.json({ error: "Custom sacrifice requires a target name" }, { status: 400 });
			}
			if (!Number.isFinite(amount) || amount <= 0) {
				return NextResponse.json({ error: "Custom sacrifice requires a pay-period amount" }, { status: 400 });
			}
			if (!Number.isFinite(goalTargetAmount) || goalTargetAmount <= 0) {
				return NextResponse.json({ error: "Custom sacrifice requires a goal target amount" }, { status: 400 });
			}
			if (!Number.isFinite(goalTargetYear) || goalTargetYear < 1900 || goalTargetYear > 3000) {
				return NextResponse.json({ error: "Custom sacrifice requires a valid target year" }, { status: 400 });
			}
		}

		const base = TYPE_LABELS[type] ?? TYPE_LABELS.custom;
		const name = rawName || base;

		const created = await createAllocationDefinition({ budgetPlanId, name, defaultAmount: amount });
		await upsertMonthlyCustomAllocationOverrides({
			budgetPlanId,
			year,
			month,
			amountsByAllocationId: { [created.id]: amount },
		});

		let goalId: string | null = null;
		if (createGoal) {
			const goal = await prisma.goal.create({
				data: {
					title: name,
					type: "long_term",
					category: "other",
					targetAmount: goalTargetAmount,
					currentAmount: 0,
					targetYear: goalTargetYear,
					budgetPlanId,
				},
				select: { id: true },
			});
			goalId = goal.id;

			await upsertSacrificeGoalLink({
				budgetPlanId,
				targetKey: `custom:${created.id}`,
				goalId: goal.id,
			});
		}

		await invalidateDashboardCache(budgetPlanId);

		return NextResponse.json({ success: true, item: created, goalId }, { status: 201 });
	} catch (error) {
		console.error("[bff/income-sacrifice/custom] POST error", error);
		return NextResponse.json({ error: "Failed to create sacrifice item" }, { status: 500 });
	}
}

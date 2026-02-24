import { NextResponse, type NextRequest } from "next/server";
import { getSessionUserId, resolveOwnedBudgetPlanId } from "@/lib/api/bffAuth";
import {
	getMonthlyAllocationSnapshot,
	getMonthlyCustomAllocationsSnapshot,
	resolveActiveBudgetYear,
	upsertMonthlyAllocation,
	upsertMonthlyCustomAllocationOverrides,
} from "@/lib/allocations/store";
import { monthNumberToKey } from "@/lib/helpers/monthKey";
import type { MonthKey } from "@/types";

export const runtime = "nodejs";

function unauthorized() {
	return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
}

function parseMonthYear(searchParams: URLSearchParams): { month: number; year: number; monthKey: MonthKey } {
	const monthRaw = Number(searchParams.get("month"));
	const yearRaw = Number(searchParams.get("year"));
	const month = Number.isFinite(monthRaw) && monthRaw >= 1 && monthRaw <= 12 ? monthRaw : new Date().getMonth() + 1;
	const year = Number.isFinite(yearRaw) ? yearRaw : new Date().getFullYear();
	const monthKey = monthNumberToKey(month as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12) as MonthKey;
	return { month, year, monthKey };
}

export async function GET(request: NextRequest) {
	try {
		const userId = await getSessionUserId();
		if (!userId) return unauthorized();

		const { searchParams } = new URL(request.url);
		const budgetPlanId = await resolveOwnedBudgetPlanId({
			userId,
			budgetPlanId: searchParams.get("budgetPlanId"),
		});
		if (!budgetPlanId) return NextResponse.json({ error: "Budget plan not found" }, { status: 404 });

		const { month, year, monthKey } = parseMonthYear(searchParams);
		const allocation = await getMonthlyAllocationSnapshot(budgetPlanId, monthKey, { year });
		const custom = await getMonthlyCustomAllocationsSnapshot(budgetPlanId, monthKey, { year });

		const fixed = {
			monthlyAllowance: Number(allocation.monthlyAllowance ?? 0),
			monthlySavingsContribution: Number(allocation.monthlySavingsContribution ?? 0),
			monthlyEmergencyContribution: Number(allocation.monthlyEmergencyContribution ?? 0),
			monthlyInvestmentContribution: Number(allocation.monthlyInvestmentContribution ?? 0),
		};
		const fixedTotal =
			fixed.monthlyAllowance +
			fixed.monthlySavingsContribution +
			fixed.monthlyEmergencyContribution +
			fixed.monthlyInvestmentContribution;

		return NextResponse.json({
			budgetPlanId,
			year,
			month,
			fixed,
			customItems: custom.items,
			customTotal: Number(custom.total ?? 0),
			totalSacrifice: fixedTotal + Number(custom.total ?? 0),
		});
	} catch (error) {
		console.error("[bff/income-sacrifice] GET error", error);
		return NextResponse.json({ error: "Failed to load income sacrifice" }, { status: 500 });
	}
}

export async function PATCH(request: NextRequest) {
	try {
		const userId = await getSessionUserId();
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

		const monthRaw = Number(body.month);
		const yearRaw = Number(body.year);
		const month = Number.isFinite(monthRaw) && monthRaw >= 1 && monthRaw <= 12 ? monthRaw : new Date().getMonth() + 1;
		const year = Number.isFinite(yearRaw) ? yearRaw : await resolveActiveBudgetYear(budgetPlanId);

		const toMoney = (value: unknown) => {
			const parsed = Number(value);
			return Number.isFinite(parsed) ? parsed : 0;
		};

		const fixed = body.fixed && typeof body.fixed === "object" ? (body.fixed as Record<string, unknown>) : {};
		await upsertMonthlyAllocation(budgetPlanId, year, month, {
			monthlyAllowance: toMoney(fixed.monthlyAllowance),
			monthlySavingsContribution: toMoney(fixed.monthlySavingsContribution),
			monthlyEmergencyContribution: toMoney(fixed.monthlyEmergencyContribution),
			monthlyInvestmentContribution: toMoney(fixed.monthlyInvestmentContribution),
		});

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
				year,
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

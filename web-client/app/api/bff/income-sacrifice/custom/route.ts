import { NextResponse, type NextRequest } from "next/server";
import { getSessionUserId, resolveOwnedBudgetPlanId } from "@/lib/api/bffAuth";
import { createAllocationDefinition, resolveActiveBudgetYear, upsertMonthlyCustomAllocationOverrides } from "@/lib/allocations/store";

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
		const monthRaw = Number(body.month);
		const month = Number.isFinite(monthRaw) && monthRaw >= 1 && monthRaw <= 12 ? monthRaw : new Date().getMonth() + 1;
		const yearRaw = Number(body.year);
		const year = Number.isFinite(yearRaw) ? yearRaw : await resolveActiveBudgetYear(budgetPlanId);

		const base = TYPE_LABELS[type] ?? TYPE_LABELS.custom;
		const name = rawName || base;

		const created = await createAllocationDefinition({ budgetPlanId, name, defaultAmount: amount });
		await upsertMonthlyCustomAllocationOverrides({
			budgetPlanId,
			year,
			month,
			amountsByAllocationId: { [created.id]: amount },
		});

		return NextResponse.json({ success: true, item: created }, { status: 201 });
	} catch (error) {
		console.error("[bff/income-sacrifice/custom] POST error", error);
		return NextResponse.json({ error: "Failed to create sacrifice item" }, { status: 500 });
	}
}

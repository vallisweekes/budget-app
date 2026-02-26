import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId, resolveOwnedBudgetPlanId } from "@/lib/api/bffAuth";

function toNumber(value: unknown): number {
	if (value == null) return 0;
	if (typeof value === "number") return Number.isFinite(value) ? value : 0;
	if (typeof value === "string") {
		const n = Number(value);
		return Number.isFinite(n) ? n : 0;
	}
	if (typeof (value as { toString?: () => string })?.toString === "function") {
		const n = Number((value as { toString: () => string }).toString());
		return Number.isFinite(n) ? n : 0;
	}
	return 0;
}

export const runtime = "nodejs";

function unauthorized() {
	return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
}

/**
 * GET /api/bff/expenses/months?budgetPlanId=<optional>
 *
 * Returns the distinct months/years that contain expenses for a plan.
 * Intended for sparse (non-personal) plans where expenses don't exist every month.
 */
export async function GET(req: NextRequest) {
	try {
		const userId = await getSessionUserId(req);
		if (!userId) return unauthorized();

		const { searchParams } = new URL(req.url);
		const budgetPlanId = await resolveOwnedBudgetPlanId({
			userId,
			budgetPlanId: searchParams.get("budgetPlanId"),
		});
		if (!budgetPlanId) {
			return NextResponse.json({ error: "Budget plan not found" }, { status: 404 });
		}

		const grouped = await prisma.expense.groupBy({
			by: ["year", "month"],
			where: { budgetPlanId },
			_count: { _all: true },
			_sum: { amount: true },
			orderBy: [{ year: "desc" }, { month: "desc" }],
		});

		const months = grouped.map((g) => {
			const totalAmount = toNumber(g._sum.amount);
			return {
				year: g.year,
				month: g.month,
				totalCount: g._count._all,
				totalAmount,
			};
		});

		return NextResponse.json({ months });
	} catch (error) {
		console.error("Failed to compute expense months:", error);
		const detail =
			process.env.NODE_ENV !== "production"
				? error instanceof Error
					? error.message
					: String(error)
				: undefined;
		return NextResponse.json(
			{ error: "Failed to compute expense months", ...(detail ? { detail } : {}) },
			{ status: 500 },
		);
	}
}

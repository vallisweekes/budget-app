import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId, resolveOwnedBudgetPlanId } from "@/lib/api/bffAuth";

export const runtime = "nodejs";

function unauthorized() {
	return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
}

function badRequest(msg: string) {
	return NextResponse.json({ error: msg }, { status: 400 });
}

function toN(v: string | null): number | null {
	if (v == null) return null;
	const n = Number(v);
	return Number.isFinite(n) ? n : null;
}

function toFloat(value: unknown): number {
	if (typeof value === "number") return value;
	const n = parseFloat(String(value ?? "0"));
	return isNaN(n) ? 0 : n;
}

/**
 * GET /api/bff/expenses/summary?month=N&year=N&budgetPlanId=<optional>
 *
 * Server-computes the full monthly expense summary so both web and mobile
 * share identical calculation logic — no client-side arithmetic needed.
 *
 * Returns:
 *   totalCount        — total number of expenses
 *   totalAmount       — sum of all expense amounts
 *   paidCount         — number of paid expenses
 *   paidAmount        — sum of paid expense amounts (uses paidAmount field)
 *   unpaidCount       — number of unpaid expenses
 *   unpaidAmount      — sum of unpaid/remaining amounts
 *   categoryBreakdown — per-category totals (sorted by total desc)
 *   month, year       — echoed back for convenience
 */
export async function GET(req: NextRequest) {
	const userId = await getSessionUserId(req);
	if (!userId) return unauthorized();

	const { searchParams } = new URL(req.url);
	const month = toN(searchParams.get("month"));
	const year = toN(searchParams.get("year"));

	if (month == null || month < 1 || month > 12) return badRequest("Invalid month");
	if (year == null || year < 1900) return badRequest("Invalid year");

	const budgetPlanId = await resolveOwnedBudgetPlanId({
		userId,
		budgetPlanId: searchParams.get("budgetPlanId"),
	});
	if (!budgetPlanId) {
		return NextResponse.json({ error: "Budget plan not found" }, { status: 404 });
	}

	// Single query with category join — same source used by web's expense store
	const expenses = await prisma.expense.findMany({
		where: { budgetPlanId, month, year },
		include: {
			category: {
				select: { id: true, name: true, color: true, icon: true },
			},
		},
		orderBy: { createdAt: "asc" },
	});

	// ── Server-side aggregations ──────────────────────────────────────────────

	let totalAmount = 0;
	let paidAmount = 0;
	let unpaidAmount = 0;
	let paidCount = 0;
	let unpaidCount = 0;

	const catMap = new Map<
		string,
		{
			categoryId: string;
			name: string;
			color: string | null;
			icon: string | null;
			total: number;
			paidTotal: number;
			paidCount: number;
			totalCount: number;
		}
	>();

	for (const exp of expenses) {
		const amount = toFloat(exp.amount);
		const paid = toFloat(exp.paidAmount);
		const unpaid = Math.max(0, amount - paid);

		totalAmount += amount;
		paidAmount += paid;
		unpaidAmount += unpaid;
		if (exp.paid) paidCount++;
		else unpaidCount++;

		// Category grouping
		const catId = exp.categoryId ?? "__none__";
		const catName = exp.category?.name ?? "Uncategorised";
		const catColor = exp.category?.color ?? null;
		const catIcon = exp.category?.icon ?? null;

		let cat = catMap.get(catId);
		if (!cat) {
			cat = {
				categoryId: catId,
				name: catName,
				color: catColor,
				icon: catIcon,
				total: 0,
				paidTotal: 0,
				paidCount: 0,
				totalCount: 0,
			};
			catMap.set(catId, cat);
		}
		cat.total += amount;
		cat.paidTotal += paid;
		cat.totalCount += 1;
		if (exp.paid) cat.paidCount += 1;
	}

	const categoryBreakdown = Array.from(catMap.values()).sort(
		(a, b) => b.total - a.total,
	);

	return NextResponse.json({
		month,
		year,
		totalCount: expenses.length,
		totalAmount: parseFloat(totalAmount.toFixed(2)),
		paidCount,
		paidAmount: parseFloat(paidAmount.toFixed(2)),
		unpaidCount,
		unpaidAmount: parseFloat(unpaidAmount.toFixed(2)),
		categoryBreakdown,
	});
}

import { NextResponse, type NextRequest } from "next/server";
import { getSessionUserId } from "@/lib/api/bffAuth";
import { getAiSpendingInsights } from "@/lib/ai/spendingInsights";

export const runtime = "nodejs";

function unauthorized() {
	return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
}

function badRequest(message: string) {
	return NextResponse.json({ error: message }, { status: 400 });
}

function toNumber(v: unknown): number {
	if (typeof v === "number") return Number.isFinite(v) ? v : 0;
	if (typeof v === "string") {
		const n = Number(v);
		return Number.isFinite(n) ? n : 0;
	}
	return 0;
}

export async function POST(req: NextRequest) {
	try {
		const userId = await getSessionUserId();
		if (!userId) return unauthorized();

		const body = await req.json().catch(() => null);
		if (!body || typeof body !== "object") return badRequest("Invalid JSON body");

		const b = body as Record<string, unknown>;
		const rawSpending = Array.isArray(b.spending) ? (b.spending as unknown[]) : [];
		const rawPrevSpending = Array.isArray(b.previousMonthSpending) ? (b.previousMonthSpending as unknown[]) : [];
		const rawAllowance = b.allowanceStats ?? null;
		const rawSavings = b.savingsBalance;
		const currentMonthLabel = typeof b.currentMonthLabel === "string" ? b.currentMonthLabel : undefined;
		const previousMonthLabel = typeof b.previousMonthLabel === "string" ? b.previousMonthLabel : undefined;

		const toEntry = (s: unknown) => {
			if (!s || typeof s !== "object") return null;
			const e = s as Record<string, unknown>;
			return {
				description: typeof e.description === "string" ? e.description : "",
				amount: toNumber(e.amount),
				date: typeof e.date === "string" ? e.date : "",
				source: typeof e.source === "string" ? e.source : "unknown",
			};
		};

		const spending = rawSpending.map(toEntry).filter((s): s is NonNullable<typeof s> => s !== null).slice(0, 80);
		const previousMonthSpending = rawPrevSpending.map(toEntry).filter((s): s is NonNullable<typeof s> => s !== null).slice(0, 80);

		if (!rawAllowance || typeof rawAllowance !== "object") return badRequest("Missing allowanceStats");
		const ra = rawAllowance as Record<string, unknown>;
		const allowanceStats = {
			monthlyAllowance: toNumber(ra.monthlyAllowance),
			totalUsed: toNumber(ra.totalUsed),
			remaining: toNumber(ra.remaining),
			percentUsed: toNumber(ra.percentUsed),
		};

		const savingsBalance = toNumber(rawSavings);
		const now = new Date();
		const cacheKey = `spending-insights:${userId}:${now.getFullYear()}-${now.getMonth() + 1}:${spending.length}:${previousMonthSpending.length}:${Math.round(
			allowanceStats.percentUsed,
		)}`;

		const insights = await (async () => {
			try {
				return await getAiSpendingInsights({
					cacheKey,
					now,
					context: { spending, previousMonthSpending, allowanceStats, savingsBalance, currentMonthLabel, previousMonthLabel },
					maxItems: 4,
				});
			} catch (err) {
				console.error("/api/insights/spending: AI failed:", err);
				return null;
			}
		})();

		return NextResponse.json({ insights: insights ?? [] });
	} catch (error) {
		console.error("/api/insights/spending error:", error);
		return NextResponse.json({ error: "Failed to generate spending insights" }, { status: 500 });
	}
}

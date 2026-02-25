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

		const rawSpending = Array.isArray((body as any).spending) ? (body as any).spending : [];
		const rawPrevSpending = Array.isArray((body as any).previousMonthSpending) ? (body as any).previousMonthSpending : [];
		const rawAllowance = (body as any).allowanceStats ?? null;
		const rawSavings = (body as any).savingsBalance;
		const currentMonthLabel = typeof (body as any).currentMonthLabel === "string" ? (body as any).currentMonthLabel : undefined;
		const previousMonthLabel = typeof (body as any).previousMonthLabel === "string" ? (body as any).previousMonthLabel : undefined;

		const spending = rawSpending
			.filter((s: any) => s && typeof s === "object")
			.slice(0, 80)
			.map((s: any) => ({
				description: typeof s.description === "string" ? s.description : "",
				amount: toNumber(s.amount),
				date: typeof s.date === "string" ? s.date : "",
				source: typeof s.source === "string" ? s.source : "unknown",
			}));

		const previousMonthSpending = rawPrevSpending
			.filter((s: any) => s && typeof s === "object")
			.slice(0, 80)
			.map((s: any) => ({
				description: typeof s.description === "string" ? s.description : "",
				amount: toNumber(s.amount),
				date: typeof s.date === "string" ? s.date : "",
				source: typeof s.source === "string" ? s.source : "unknown",
			}));

		if (!rawAllowance || typeof rawAllowance !== "object") return badRequest("Missing allowanceStats");
		const allowanceStats = {
			monthlyAllowance: toNumber((rawAllowance as any).monthlyAllowance),
			totalUsed: toNumber((rawAllowance as any).totalUsed),
			remaining: toNumber((rawAllowance as any).remaining),
			percentUsed: toNumber((rawAllowance as any).percentUsed),
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

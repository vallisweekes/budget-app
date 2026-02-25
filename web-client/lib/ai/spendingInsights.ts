import OpenAI from "openai";

export type SpendingInsightColor = "red" | "orange" | "amber" | "blue" | "emerald" | "purple";
export type SpendingInsightIcon =
	| "alert"
	| "lightbulb"
	| "trendUp"
	| "trendDown";

export type SpendingInsight = {
	type: "warning" | "info" | "success";
	title: string;
	message: string;
	recommendation: string;
	color: SpendingInsightColor;
	icon: SpendingInsightIcon;
};

type CacheEntry = { expiresAt: number; insights: SpendingInsight[] };
const cache = new Map<string, CacheEntry>();

function clampText(s: string, max: number): string {
	const t = String(s ?? "").trim().replace(/\s+/g, " ");
	if (!t) return "";
	return t.length <= max ? t : `${t.slice(0, Math.max(0, max - 1)).trim()}…`;
}

function safeParseJsonObject(raw: string): Record<string, unknown> | null {
	try {
		const parsed = JSON.parse(raw);
		return parsed && typeof parsed === "object" && !Array.isArray(parsed)
			? (parsed as Record<string, unknown>)
			: null;
	} catch {
		return null;
	}
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
	let timeoutId: any;
	try {
		const timeout = new Promise<null>((resolve) => {
			timeoutId = setTimeout(() => resolve(null), ms);
		});
		return (await Promise.race([promise, timeout])) as T | null;
	} finally {
		if (timeoutId) clearTimeout(timeoutId);
	}
}

function normalizeInsights(input: unknown, maxItems: number): SpendingInsight[] {
	if (!Array.isArray(input)) return [];
	const out: SpendingInsight[] = [];
	for (const it of input) {
		const type = (it as any)?.type;
		const title = typeof (it as any)?.title === "string" ? clampText((it as any).title, 50) : "";
		const message = typeof (it as any)?.message === "string" ? clampText((it as any).message, 160) : "";
		const recommendation =
			typeof (it as any)?.recommendation === "string"
				? clampText((it as any).recommendation, 160)
				: "";

		const color = (it as any)?.color;
		const icon = (it as any)?.icon;

		if (type !== "warning" && type !== "info" && type !== "success") continue;
		if (!title || !message || !recommendation) continue;
		if (!(["red", "orange", "amber", "blue", "emerald", "purple"] as const).includes(color)) continue;
		if (!(["alert", "lightbulb", "trendUp", "trendDown"] as const).includes(icon)) continue;

		out.push({
			type,
			title,
			message,
			recommendation,
			color,
			icon,
		});
		if (out.length >= maxItems) break;
	}
	return out;
}

export async function getAiSpendingInsights(args: {
	cacheKey: string;
	now: Date;
	context: {
		spending: Array<{ description: string; amount: number; date: string; source: string }>;
		allowanceStats: {
			monthlyAllowance: number;
			totalUsed: number;
			remaining: number;
			percentUsed: number;
		};
		savingsBalance: number;
	};
	maxItems?: number;
}): Promise<SpendingInsight[] | null> {
	const apiKey = process.env.OPENAI_API_KEY;
	if (!apiKey) return null;

	const maxItems = Math.max(1, Math.min(6, args.maxItems ?? 4));
	const cached = cache.get(args.cacheKey);
	if (cached && cached.expiresAt > Date.now()) return cached.insights;

	const openai = new OpenAI({ apiKey });

	// Keep payload small: cap transactions and strip to essentials.
	const spending = (args.context.spending ?? []).slice(0, 40).map((s) => ({
		description: clampText(s.description, 60),
		amount: s.amount,
		date: s.date,
		source: s.source,
	}));

	const sys =
		"You are a budgeting assistant. Generate actionable spending insights based ONLY on the provided data. " +
		"Avoid shame, avoid legal/medical advice, and do not mention OpenAI. " +
		"Return ONLY valid JSON: {\"insights\":[{\"type\":\"warning\"|\"info\"|\"success\",\"title\":string,\"message\":string,\"recommendation\":string,\"color\":\"red\"|\"orange\"|\"amber\"|\"blue\"|\"emerald\"|\"purple\",\"icon\":\"alert\"|\"lightbulb\"|\"trendUp\"|\"trendDown\"}]}. " +
		"Constraints: max insights = " +
		String(maxItems) +
		", title <= 50 chars, message <= 160 chars, recommendation <= 160 chars. " +
		"Use icons/colors consistently: warnings use alert+red/orange/amber; successes use trendDown+emerald; neutral info can use lightbulb/blue or trendUp/purple.";

	const user = JSON.stringify(
		{
			now: args.now.toISOString().slice(0, 10),
			allowanceStats: args.context.allowanceStats,
			savingsBalance: args.context.savingsBalance,
			spending,
		},
		null,
		2,
	);

	const completion = await withTimeout(
		openai.chat.completions.create({
			model: "gpt-4o-mini",
			temperature: 0.35,
			messages: [
				{ role: "system", content: sys },
				{ role: "user", content: user },
			],
		}),
		1200,
	);

	if (!completion) return null;
	const raw = completion.choices?.[0]?.message?.content ?? "";
	const obj = safeParseJsonObject(raw);
	const insights = normalizeInsights(obj?.insights, maxItems);
	if (!insights.length) return null;

	cache.set(args.cacheKey, { insights, expiresAt: Date.now() + 2 * 60 * 60 * 1000 });
	return insights;
}

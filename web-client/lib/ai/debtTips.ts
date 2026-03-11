import OpenAI from "openai";
import { getJsonCache, setJsonCache } from "@/lib/cache/redisJsonCache";

export type DebtTip = { title: string; detail: string; urgency?: string };

const CACHE_TTL_SECONDS = 6 * 60 * 60;

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
	let timeoutId: ReturnType<typeof setTimeout> | undefined;
	try {
		const timeout = new Promise<null>((resolve) => {
			timeoutId = setTimeout(() => resolve(null), ms);
		});
		return (await Promise.race([promise, timeout])) as T | null;
	} finally {
		if (timeoutId) clearTimeout(timeoutId);
	}
}

function normalizeTips(input: unknown, maxTips: number): DebtTip[] {
	if (!Array.isArray(input)) return [];
	const tips: DebtTip[] = [];
	for (const t of input) {
		const item = (t !== null && typeof t === "object" ? t : {}) as Record<string, unknown>;
		const title = typeof item.title === "string" ? clampText(item.title, 60) : "";
		const detail = typeof item.detail === "string" ? clampText(item.detail, 180) : "";
		if (!title || !detail) continue;
		tips.push({ title, detail });
		if (tips.length >= maxTips) break;
	}
	return tips;
}

export async function getAiDebtTips(args: {
	cacheKey: string;
	now: Date;
	context: {
		activeCount: number;
		totalDebtBalance: number;
		totalMonthlyDebtPayments: number;
		creditCardCount: number;
		regularDebtCount: number;
		expenseDebtCount: number;
		topDebts?: Array<{ name: string; currentBalance: number; monthlyPayment?: number | null; dueDay?: number | null }>;
		existingTips?: Array<{ title: string; detail: string }>;
	};
	maxTips?: number;
}): Promise<DebtTip[] | null> {
	const apiKey = process.env.OPENAI_API_KEY;
	if (!apiKey) return null;

	const maxTips = Math.max(1, Math.min(6, args.maxTips ?? 4));
	const cached = await getJsonCache<DebtTip[]>(args.cacheKey);
	if (cached?.length) return cached;

	if (!(args.context.totalDebtBalance > 0) || args.context.activeCount <= 0) return null;

	const openai = new OpenAI({ apiKey });

	const sys =
		"You are a budgeting assistant helping the user manage debt. " +
		"Provide practical, non-judgmental tips grounded in the numbers. " +
		"Return ONLY valid JSON: {\"tips\":[{\"title\":string,\"detail\":string}]}. " +
		"Constraints: title <= 60 chars, detail is 1 sentence <= 180 chars, max tips = " +
		String(maxTips) + ".";

	const user = JSON.stringify(
		{
			now: args.now.toISOString().slice(0, 10),
			...args.context,
		},
		null,
		2
	);

	const completion = await withTimeout(
		openai.chat.completions.create({
			model: "gpt-4o-mini",
			temperature: 0.4,
			messages: [
				{ role: "system", content: sys },
				{ role: "user", content: user },
			],
		}),
		1200
	);

	if (!completion) return null;
	const raw = completion.choices?.[0]?.message?.content ?? "";
	const obj = safeParseJsonObject(raw);
	const tips = normalizeTips(obj?.tips, maxTips);
	if (!tips.length) return null;

	await setJsonCache(args.cacheKey, tips, CACHE_TTL_SECONDS);
	return tips;
}

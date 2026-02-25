import OpenAI from "openai";

import type { Goal } from "@/lib/goals/store";
import type { GoalsBudgetInsights } from "@/types";

type CacheEntry = { expiresAt: number; tipsById: Record<string, string> };
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

function normalizeTipsById(input: unknown, maxChars: number): Record<string, string> {
	const out: Record<string, string> = {};
	if (!Array.isArray(input)) return out;
	for (const it of input) {
		const goalId = typeof (it as any)?.goalId === "string" ? (it as any).goalId : "";
		const tip = typeof (it as any)?.tip === "string" ? clampText((it as any).tip, maxChars) : "";
		if (!goalId || !tip) continue;
		out[goalId] = tip;
	}
	return out;
}

export async function getAiGoalMonthlyTips(args: {
	cacheKey: string;
	now: Date;
	goals: Array<{
		goal: Goal;
		effectiveCurrentAmount: number;
		existingTip: string | null;
	}>;
	budgetInsights?: GoalsBudgetInsights | null;
	maxChars?: number;
}): Promise<Record<string, string> | null> {
	const apiKey = process.env.OPENAI_API_KEY;
	if (!apiKey) return null;

	const maxChars = Math.max(120, Math.min(320, args.maxChars ?? 220));
	const cached = cache.get(args.cacheKey);
	if (cached && cached.expiresAt > Date.now()) return cached.tipsById;

	const openai = new OpenAI({ apiKey });

	const goals = args.goals.slice(0, 24).map((g) => ({
		goalId: g.goal.id,
		title: clampText(g.goal.title, 60),
		category: (g.goal as any).category ?? null,
		targetAmount: g.goal.targetAmount ?? null,
		currentAmount: g.effectiveCurrentAmount,
		targetYear: (g.goal as any).targetYear ?? null,
		existingTip: g.existingTip,
	}));

	const budget = args.budgetInsights
		? {
			basisLabel: args.budgetInsights.basisLabel,
			avgUnallocated: args.budgetInsights.avgUnallocated,
			avgPlannedAllowance: args.budgetInsights.avgPlannedAllowance,
			avgSpendingTotal: args.budgetInsights.avgSpendingTotal,
		}
		: null;

	const sys =
		"You are a budgeting assistant helping users hit savings/debt goals. " +
		"For each goal, write a single concise tip that helps the user understand what to do next this month. " +
		"Ground the advice in the numbers given, avoid shame, avoid legal/medical advice, and do not mention OpenAI. " +
		"Return ONLY valid JSON: {\"tips\":[{\"goalId\":string,\"tip\":string}]}. " +
		"Constraints: tip is 1-2 sentences, <= " +
		String(maxChars) +
		" chars. Prefer using the existingTip when it is already good, but you can rewrite it to be clearer.";

	const user = JSON.stringify(
		{
			now: args.now.toISOString().slice(0, 10),
			budget,
			goals,
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
	const tipsById = normalizeTipsById(obj?.tips, maxChars);
	if (!Object.keys(tipsById).length) return null;

	cache.set(args.cacheKey, { tipsById, expiresAt: Date.now() + 2 * 60 * 60 * 1000 });
	return tipsById;
}

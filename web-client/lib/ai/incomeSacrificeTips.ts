import OpenAI from "openai";

import { getJsonCache, setJsonCache } from "@/lib/cache/redisJsonCache";
import { prioritizeRecapTips, type RecapTip } from "@/lib/expenses/insights";

const CACHE_TTL_SECONDS = 2 * 60 * 60;

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

function normalizeTips(input: unknown, maxTips: number): RecapTip[] {
	if (!Array.isArray(input)) return [];
	const tips: RecapTip[] = [];
	for (const t of input) {
		const item = (t !== null && typeof t === "object" ? t : {}) as Record<string, unknown>;
		const title = typeof item.title === "string" ? clampText(item.title, 60) : "";
		const detail = typeof item.detail === "string" ? clampText(item.detail, 180) : "";
		const rawPriority = Number(item.priority);
		const priority = Number.isFinite(rawPriority)
			? Math.max(1, Math.min(100, Math.round(rawPriority)))
			: undefined;
		if (!title || !detail) continue;
		tips.push({ title, detail, priority });
		if (tips.length >= maxTips) break;
	}
	return prioritizeRecapTips(tips, maxTips);
}

type SacrificeTipsContext = {
	month: number;
	year: number;
	totalSacrifice: number;
	fixed: {
		monthlyAllowance: number;
		monthlySavingsContribution: number;
		monthlyEmergencyContribution: number;
		monthlyInvestmentContribution: number;
	};
	customItems: Array<{ name: string; amount: number }>;
	goalLinks: Array<{ goalTitle: string; targetKey: string }>;
	pendingTransferTotal: number;
	transferredTotal: number;
	plannedTotal: number;
};

function buildFallbackSacrificeTips(context: SacrificeTipsContext, maxTips: number): RecapTip[] {
	const allowance = Number(context.fixed.monthlyAllowance ?? 0);
	const savings = Number(context.fixed.monthlySavingsContribution ?? 0);
	const emergency = Number(context.fixed.monthlyEmergencyContribution ?? 0);
	const investments = Number(context.fixed.monthlyInvestmentContribution ?? 0);
	const customTotal = context.customItems.reduce((sum, item) => sum + Number(item.amount ?? 0), 0);
	const total = Number(context.totalSacrifice ?? 0);
	const tips: RecapTip[] = [];

	if (total <= 0) {
		tips.push({
			title: "Start with one small sacrifice",
			detail: "Set one amount for this period first, then extend it across future periods once it feels sustainable.",
			priority: 82,
		});
	}

	if (allowance > 0 && savings + emergency + investments + customTotal === 0) {
		tips.push({
			title: "Allowance is doing all the work",
			detail: "Move a small share into savings or emergency so not all of this sacrifice stays immediately available to spend.",
			priority: 88,
		});
	}

	if (total > 0 && emergency <= 0) {
		tips.push({
			title: "Emergency cover is still empty",
			detail: "Even a small emergency allocation can make the next unexpected cost easier to absorb without undoing your plan.",
			priority: 84,
		});
	}

	if (savings <= 0 && total > 0) {
		tips.push({
			title: "Savings is missing from the split",
			detail: "Adding a modest savings amount can stop every future goal from competing with your allowance pot.",
			priority: 70,
		});
	}

	if (context.goalLinks.length > 0 && context.pendingTransferTotal > 0) {
		tips.push({
			title: "Linked goals need confirming",
			detail: "Confirm transferred sacrifices after you move them so linked goal progress stays in sync with this plan.",
			priority: 74,
		});
	}

	if (context.customItems.length > 0) {
		tips.push({
			title: "Custom sacrifices are active",
			detail: "Keep each custom item specific and distinct so you can review quickly which one still deserves a share next period.",
			priority: 60,
		});
	}

	if (!tips.length) {
		tips.push({
			title: "This sacrifice split looks balanced",
			detail: "Review the start period before saving longer ranges so the same split carries forward from the right pay-period anchor.",
			priority: 58,
		});
	}

	return prioritizeRecapTips(tips, maxTips);
}

export async function getAiIncomeSacrificeTips(args: {
	cacheKey: string;
	now: Date;
	context: SacrificeTipsContext;
	maxTips?: number;
}): Promise<RecapTip[]> {
	const maxTips = Math.max(1, Math.min(6, args.maxTips ?? 4));
	const fallbackTips = buildFallbackSacrificeTips(args.context, maxTips);
	const apiKey = process.env.OPENAI_API_KEY;
	if (!apiKey) return fallbackTips;

	const cached = await getJsonCache<RecapTip[]>(args.cacheKey);
	if (cached?.length) return prioritizeRecapTips(cached, maxTips);

	const openai = new OpenAI({ apiKey });
	const openLinks = args.context.goalLinks.slice(0, 6).map((link) => ({
		goalTitle: clampText(link.goalTitle, 60),
		targetKey: link.targetKey,
	}));
	const customItems = args.context.customItems.slice(0, 8).map((item) => ({
		name: clampText(item.name, 48),
		amount: Number(item.amount ?? 0) || 0,
	}));

	const sys =
		"You are a budgeting assistant helping a user review their income sacrifice plan for the current pay period. " +
		"Use the allocation mix, custom items, and linked goal signals to produce practical advice grounded in the numbers. " +
		"Prefer specific budgeting actions such as rebalancing toward savings, adding emergency cover, simplifying custom items, or keeping linked goals up to date. " +
		"Avoid shame, avoid generic fluff, and do not mention OpenAI. " +
		"Return ONLY valid JSON: {\"tips\":[{\"title\":string,\"detail\":string,\"priority\":number}]}. " +
		"Constraints: title <= 60 chars, detail is 1 sentence <= 180 chars, max tips = " +
		String(maxTips) + ".";

	const user = JSON.stringify(
		{
			now: args.now.toISOString().slice(0, 10),
			period: { month: args.context.month, year: args.context.year },
			totals: {
				totalSacrifice: args.context.totalSacrifice,
				plannedTotal: args.context.plannedTotal,
				transferredTotal: args.context.transferredTotal,
				pendingTransferTotal: args.context.pendingTransferTotal,
			},
			fixed: args.context.fixed,
			customItems,
			goalLinks: openLinks,
			existingTips: fallbackTips,
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

	if (!completion) return fallbackTips;
	const raw = completion.choices?.[0]?.message?.content ?? "";
	const obj = safeParseJsonObject(raw);
	const aiTips = normalizeTips(obj?.tips, maxTips);
	const finalTips = aiTips.length ? aiTips : fallbackTips;

	await setJsonCache(args.cacheKey, finalTips, CACHE_TTL_SECONDS);
	return finalTips;
}
import OpenAI from "openai";
import {
	prioritizeRecapTips,
	type RecapTip,
	type PreviousMonthRecap,
	type UpcomingPayment,
} from "@/lib/expenses/insights";

type CacheEntry = { expiresAt: number; tips: RecapTip[] };
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
		const item = t as Record<string, unknown>;
		const title = typeof item.title === "string" ? clampText(item.title, 60) : "";
		const detail = typeof item.detail === "string" ? clampText(item.detail, 180) : "";
		const rawPriority = Number(item.priority);
		const priority = Number.isFinite(rawPriority) ? Math.max(1, Math.min(100, Math.round(rawPriority))) : undefined;
		if (!title || !detail) continue;
		tips.push({ title, detail, priority });
		if (tips.length >= maxTips) break;
	}
	return prioritizeRecapTips(tips, maxTips);
}

export async function getAiBudgetTips(args: {
	cacheKey: string;
	budgetPlanId: string;
	now: Date;
	context: {
		username?: string | null;
		totalIncome?: number;
		totalExpenses?: number;
		remaining?: number;
		plannedDebtPayments?: number;
		plannedSavingsContribution?: number;
		payDate?: number;
		recap?: PreviousMonthRecap | null;
		upcoming?: UpcomingPayment[];
		existingTips?: RecapTip[];
	};
	maxTips?: number;
}): Promise<RecapTip[] | null> {
	const apiKey = process.env.OPENAI_API_KEY;
	if (!apiKey) return null;

	const maxTips = Math.max(1, Math.min(6, args.maxTips ?? 4));
	const cached = cache.get(args.cacheKey);
	if (cached && cached.expiresAt > Date.now()) return cached.tips;

	const openai = new OpenAI({ apiKey });

	const upcoming = (args.context.upcoming ?? []).slice(0, 6).map((u) => ({
		name: u.name,
		amount: u.amount,
		dueDate: u.dueDate,
		daysUntilDue: u.daysUntilDue,
		urgency: u.urgency,
		status: u.status,
	}));

	const recap = args.context.recap
		? {
			label: args.context.recap.label,
			totalAmount: args.context.recap.totalAmount,
			totalCount: args.context.recap.totalCount,
			paidAmount: args.context.recap.paidAmount,
			paidCount: args.context.recap.paidCount,
			unpaidAmount: args.context.recap.unpaidAmount,
			unpaidCount: args.context.recap.unpaidCount,
			partialAmount: args.context.recap.partialAmount,
			partialCount: args.context.recap.partialCount,
			missedDueAmount: args.context.recap.missedDueAmount,
			missedDueCount: args.context.recap.missedDueCount,
		}
		: null;

	const existingTips = (args.context.existingTips ?? []).slice(0, 6).map((t) => ({
		title: t.title,
		detail: t.detail,
	}));

	const sys =
		"You are a budgeting assistant inside a bill-tracking app. " +
		"Generate practical, friendly tips grounded in the provided numbers. " +
		"Avoid shame, avoid legal/medical advice, and do not mention OpenAI. " +
		"Return ONLY valid JSON: {\"tips\":[{\"title\":string,\"detail\":string,\"priority\":number}]}. " +
		"Set priority from 1-100 (100 = most urgent). Prioritise debt-reduction and savings-protection actions first. " +
		"Constraints: title <= 60 chars, detail is 1 sentence <= 180 chars, max tips = " +
		String(maxTips) + ".";

	const user = JSON.stringify(
		{
			username: args.context.username ?? null,
			now: args.now.toISOString().slice(0, 10),
			totals: {
				totalIncome: args.context.totalIncome ?? null,
				totalExpenses: args.context.totalExpenses ?? null,
				remaining: args.context.remaining ?? null,
				plannedDebtPayments: args.context.plannedDebtPayments ?? null,
				plannedSavingsContribution: args.context.plannedSavingsContribution ?? null,
				payDate: args.context.payDate ?? null,
			},
			recap,
			upcoming,
			existingTips,
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

	cache.set(args.cacheKey, { tips, expiresAt: Date.now() + 2 * 60 * 60 * 1000 });
	return tips;
}

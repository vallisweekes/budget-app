import OpenAI from "openai";

function norm(s: string): string {
	return String(s ?? "").trim().toLowerCase();
}

function includesAny(haystack: string, needles: string[]): boolean {
	return needles.some((n) => haystack.includes(n));
}

function heuristicCategory(expenseName: string): string | null {
	const n = norm(expenseName);
	if (!n) return null;

	// Housing
	if (
		includesAny(n, [
			"rent",
			"mortgage",
			"landlord",
			"lease",
			"apartment",
			"flat",
			"condo",
			"housing",
			"council tax",
		])
	) {
		return "Housing";
	}

	// Utilities
	if (
		includesAny(n, [
			"electric",
			"electricity",
			"power",
			"water",
			"sewer",
			"gas bill",
			"broadband",
			"internet",
			"wifi",
			"utility",
		])
	) {
		return "Utilities";
	}

	// Subscriptions (phone + streaming)
	if (
		includesAny(n, [
			"netflix",
			"spotify",
			"apple music",
			"prime",
			"amazon prime",
			"disney",
			"hulu",
			"youtube premium",
			"subscription",
			"membership",
			"mobile",
			"cell",
			"phone plan",
		])
	) {
		return "Subscriptions";
	}

	// Transport
	if (
		includesAny(n, [
			"uber",
			"lyft",
			"taxi",
			"bus",
			"train",
			"metro",
			"fuel",
			"petrol",
			"diesel",
			"parking",
			"toll",
			"car payment",
		])
	) {
		return "Transport";
	}

	// Food
	if (includesAny(n, ["grocer", "grocery", "supermarket", "food", "dining", "takeaway", "restaurant"])) {
		return "Food & Dining";
	}

	// Insurance
	if (includesAny(n, ["insurance", "premium", "policy"])) {
		return "Insurance";
	}

	// Childcare
	if (includesAny(n, ["childcare", "daycare", "nursery"])) {
		return "Childcare";
	}

	// Savings
	if (includesAny(n, ["savings", "save", "emergency fund"])) {
		return "Savings";
	}

	return null;
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

const cache = new Map<string, string | null>();

export async function suggestCategoryNameForExpense(params: {
	expenseName: string;
	availableCategories: string[];
}): Promise<string | null> {
	const expenseName = String(params.expenseName ?? "").trim();
	if (!expenseName) return null;

	const available = (params.availableCategories ?? []).filter(Boolean);
	if (!available.length) return null;

	const cacheKey = `${norm(expenseName)}|${available.map((c) => c.toLowerCase()).sort().join(",")}`;
	const cached = cache.get(cacheKey);
	if (cached !== undefined) return cached;

	const wanted = heuristicCategory(expenseName);
	if (wanted) {
		const match = available.find((c) => c.toLowerCase() === wanted.toLowerCase()) ?? null;
		cache.set(cacheKey, match);
		return match;
	}

	const apiKey = process.env.OPENAI_API_KEY;
	if (!apiKey) {
		cache.set(cacheKey, null);
		return null;
	}

	// OpenAI fallback for ambiguous merchant-style names (e.g. "British Gas", "Digicel", "Flow").
	const openai = new OpenAI({ apiKey });
	const sys =
		"You are categorizing a single monthly bill for a budgeting app. " +
		"Choose exactly ONE category from the provided list. " +
		"Return ONLY valid JSON: {\"category\": string|null}.";

	const user = JSON.stringify(
		{
			expenseName,
			categories: available,
		},
		null,
		2
	);

	let completion:
		| Awaited<ReturnType<typeof openai.chat.completions.create>>
		| null = null;
	try {
		completion = await withTimeout(
			openai.chat.completions.create({
				model: "gpt-4o-mini",
				temperature: 0,
				messages: [
					{ role: "system", content: sys },
					{ role: "user", content: user },
				],
			}),
			900
		);
	} catch {
		completion = null;
	}

	if (!completion) {
		cache.set(cacheKey, null);
		return null;
	}

	const raw = completion.choices?.[0]?.message?.content ?? "";
	const obj = safeParseJsonObject(raw);
	const category = typeof obj?.category === "string" ? obj.category.trim() : null;
	if (!category) {
		cache.set(cacheKey, null);
		return null;
	}

	const match = available.find((c) => c.toLowerCase() === category.toLowerCase()) ?? null;
	cache.set(cacheKey, match);
	return match;
}

import OpenAI from "openai";

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

function truthyEnv(name: string): boolean {
	const v = process.env[name];
	if (!v) return false;
	return v === "1" || v.toLowerCase() === "true" || v.toLowerCase() === "yes";
}

export type PushCopy = { title: string; body?: string };

export async function maybeGeneratePushCopy(args: {
	event: string;
	context: Record<string, unknown>;
	fallback: PushCopy;
}): Promise<PushCopy> {
	const apiKey = process.env.OPENAI_API_KEY;
	const enabled = truthyEnv("PUSH_NOTIFICATIONS_AI");
	if (!enabled || !apiKey) return args.fallback;

	const model = process.env.PUSH_NOTIFICATIONS_AI_MODEL || "gpt-4o-mini";
	const timeoutMs = Math.max(200, Math.min(2500, Number(process.env.PUSH_NOTIFICATIONS_AI_TIMEOUT_MS) || 900));

	const openai = new OpenAI({ apiKey });

	const sys =
		"You write short push notifications inside a budgeting app. " +
		"Tone: supportive, calm, non-judgmental. Never shame the user. Do not mention OpenAI. " +
		"Debt-related notifications must NOT sound scary or urgent. Avoid words like: urgent, warning, overdue, exceeded, missed, penalty, failure. " +
		"Expense-related notifications should make the user feel organised and in a good place without encouraging overspending. " +
		"When event is budget_tip and context shows active debt, prefer a small debt-acceleration nudge (extra payment, focus highest-interest first). " +
		"When event is budget_tip and context includes recurring/subscription candidates, suggest reviewing or cancelling one unnecessary recurring charge. " +
		"Return ONLY valid JSON: {\"title\":string,\"body\":string}. " +
		"Constraints: title <= 48 chars, body <= 140 chars. No emojis.";

	const user = JSON.stringify(
		{
			event: args.event,
			context: args.context,
			fallback: args.fallback,
		},
		null,
		2
	);

	const completion = await withTimeout(
		openai.chat.completions.create({
			model,
			temperature: 0.6,
			messages: [
				{ role: "system", content: sys },
				{ role: "user", content: user },
			],
		}),
		timeoutMs
	);

	if (!completion) return args.fallback;
	const raw = completion.choices?.[0]?.message?.content ?? "";
	const obj = safeParseJsonObject(raw);
	if (!obj) return args.fallback;

	const title = typeof obj.title === "string" ? clampText(obj.title, 48) : "";
	const body = typeof obj.body === "string" ? clampText(obj.body, 140) : "";
	if (!title) return args.fallback;
	return { title, body: body || undefined };
}

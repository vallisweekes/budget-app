import { maybeGeneratePushCopy } from "@/lib/push/aiCopy";

export type ActivityWebPushPayload = {
	title: string;
	body?: string;
	url?: string;
};

export type ActivityMobilePushPayload = {
	title: string;
	body?: string;
	data?: Record<string, unknown>;
};

function pickOne<T>(items: T[]): T {
	if (!items.length) throw new Error("pickOne requires at least one item");
	return items[Math.floor(Math.random() * items.length)]!;
}

function money(amount: number, currency: string): string {
	try {
		return new Intl.NumberFormat("en-GB", {
			style: "currency",
			currency,
			maximumFractionDigits: 2,
		}).format(amount);
	} catch {
		return `${currency} ${amount.toFixed(2)}`;
	}
}

export async function buildPaymentMadeActivity(params: {
	name: string;
	amount: number;
	currency: string;
	url?: string;
	kind?: "expense" | "debt";
}): Promise<{ web: ActivityWebPushPayload; mobile: ActivityMobilePushPayload }> {
	const label = params.kind === "expense" ? "expense" : params.kind === "debt" ? "debt" : "payment";
	const amountText = money(params.amount, params.currency);

	const fallbackTitle = pickOne([
		"Payment recorded",
		"Nice one — payment logged",
		"Solid progress",
		"Good move",
	]);

	const fallbackBody = pickOne([
		`${amountText} paid toward ${params.name}.`,
		`Logged ${amountText} for ${params.name}. Keep going.`,
		`${amountText} down on ${params.name}. Step by step.`,
		`Payment in: ${amountText} for ${params.name}.`,
		`That’s ${amountText} closer on ${params.name}.`,
	]);

	const url = params.url ?? "/dashboard";
	const { title, body } = await maybeGeneratePushCopy({
		event: "payment_made",
		context: {
			label,
			name: params.name,
			amount: params.amount,
			amountText,
			currency: params.currency,
			url,
		},
		fallback: { title: fallbackTitle, body: fallbackBody },
	});

	return {
		web: { title, body, url },
		mobile: {
			title,
			body,
			data: {
				type: "payment_made",
				label,
				name: params.name,
				amount: params.amount,
				currency: params.currency,
				url,
			},
		},
	};
}

export async function buildPlanCreatedActivity(params: {
	kind: "personal" | "holiday" | "carnival";
	name: string;
	url?: string;
}): Promise<{ web: ActivityWebPushPayload; mobile: ActivityMobilePushPayload }> {
	const url = params.url ?? "/dashboard";

	const fallbackTitle =
		params.kind === "carnival"
			? pickOne(["Carnival plan ready", "Carnival budgeting: unlocked", "Road-ready plan created"])
			: params.kind === "holiday"
				? pickOne(["Holiday plan created", "Holiday budgeting: locked in", "Trip planning starts now"])
				: pickOne(["Plan created", "New plan ready", "You’re set up"]);

	const fallbackBody =
		params.kind === "personal"
			? pickOne([
				`Your plan “${params.name}” is ready.`,
				`Plan “${params.name}” is set — let’s build momentum.`,
			])
			: pickOne([
				`Plan “${params.name}” is ready — budget with confidence.`,
				`“${params.name}” is created. Keep it fun, keep it funded.`,
				`Plan “${params.name}” is live. Small steps add up.`,
			]);

	const { title, body } = await maybeGeneratePushCopy({
		event: "plan_created",
		context: {
			kind: params.kind,
			name: params.name,
			url,
		},
		fallback: { title: fallbackTitle, body: fallbackBody },
	});

	return {
		web: { title, body, url },
		mobile: {
			title,
			body,
			data: {
				type: "plan_created",
				kind: params.kind,
				name: params.name,
				url,
			},
		},
	};
}

export async function buildExpenseAddedActivity(params: {
	name: string;
	amount: number;
	currency: string;
	url?: string;
}): Promise<{ web: ActivityWebPushPayload; mobile: ActivityMobilePushPayload }> {
	const amountText = money(params.amount, params.currency);
	const fallbackTitle = pickOne(["Expense added", "Tracked", "Added to your plan", "Noted"]);
	const fallbackBody = pickOne([
		`${params.name} added (${amountText}).`,
		`Logged ${params.name}: ${amountText}.`,
		`${params.name} is in — you’re staying on top of it.`,
	]);
	const url = params.url ?? "/dashboard";

	const { title, body } = await maybeGeneratePushCopy({
		event: "expense_added",
		context: {
			name: params.name,
			amount: params.amount,
			amountText,
			currency: params.currency,
			url,
			goalTone: "make user feel they are in a good place",
		},
		fallback: { title: fallbackTitle, body: fallbackBody },
	});

	return {
		web: { title, body, url },
		mobile: {
			title,
			body,
			data: {
				type: "expense_added",
				name: params.name,
				amount: params.amount,
				currency: params.currency,
				url,
			},
		},
	};
}

export async function buildDebtAddedActivity(params: {
	name: string;
	balance: number;
	currency: string;
	url?: string;
}): Promise<{ web: ActivityWebPushPayload; mobile: ActivityMobilePushPayload }> {
	const balanceText = money(params.balance, params.currency);
	const fallbackTitle = pickOne([
		"Debt added — you’re on it",
		"All set — debt tracked",
		"Added to your plan",
		"Good start — let’s chip away",
	]);
	const fallbackBody = pickOne([
		`Now tracking “${params.name}” (${balanceText}). You’ve got this.`,
		`“${params.name}” is saved at ${balanceText}. Small moves, steady wins.`,
		`Added “${params.name}” with a balance of ${balanceText}. Next up: set a monthly target and keep it moving.`,
		`You’re organised — “${params.name}” is now in your plan (${balanceText}).`,
		`Nice. “${params.name}” is tracked (${balanceText}). One payment at a time.`,
	]);
	const url = params.url ?? "/dashboard";

	const { title, body } = await maybeGeneratePushCopy({
		event: "debt_added",
		context: {
			name: params.name,
			balance: params.balance,
			balanceText,
			currency: params.currency,
			url,
			goalTone: "calm, not scary",
		},
		fallback: { title: fallbackTitle, body: fallbackBody },
	});

	return {
		web: { title, body, url },
		mobile: {
			title,
			body,
			data: {
				type: "debt_added",
				name: params.name,
				balance: params.balance,
				currency: params.currency,
				url,
			},
		},
	};
}

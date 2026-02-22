import type { RecapTip } from "@/lib/expenses/insights";
import { formatCurrency } from "@/lib/helpers/money";

type DebtLike = {
	id?: string;
	name: string;
	type?: string;
	currentBalance: number;
	creditLimit?: number;
	defaultPaymentSource?: string;
	defaultPaymentCardDebtId?: string;
	dueDay?: number;
	amount?: number;
	monthlyMinimum?: number;
	interestRate?: number;
};

function toFiniteNumber(value: unknown): number {
	const n = typeof value === "number" ? value : Number(value);
	return Number.isFinite(n) ? n : 0;
}

function pct(value: number): string {
	const n = toFiniteNumber(value);
	return `${n.toFixed(1)}%`;
}

function money(n: number): string {
	const v = toFiniteNumber(n);
	return formatCurrency(v);
}

function clampTips(tips: RecapTip[], limit = 4): RecapTip[] {
	const unique: RecapTip[] = [];
	const seen = new Set<string>();
	for (const t of tips) {
		const key = `${t.title}::${t.detail}`;
		if (seen.has(key)) continue;
		seen.add(key);
		unique.push(t);
		if (unique.length >= limit) break;
	}
	return unique;
}

export function computeDebtTips(args: {
	debts: DebtLike[];
	totalIncome?: number;
}): RecapTip[] {
	const debts = Array.isArray(args.debts)
		? args.debts
			.map((d) => ({
				id: d?.id == null ? undefined : String(d.id),
				name: String(d?.name ?? "").trim(),
				type: d?.type == null ? undefined : String(d.type),
				currentBalance: toFiniteNumber(d?.currentBalance),
				creditLimit: d?.creditLimit == null ? undefined : toFiniteNumber(d.creditLimit),
				defaultPaymentSource: d?.defaultPaymentSource == null ? undefined : String(d.defaultPaymentSource),
				defaultPaymentCardDebtId:
					d?.defaultPaymentCardDebtId == null ? undefined : String(d.defaultPaymentCardDebtId),
				dueDay: d?.dueDay == null ? undefined : toFiniteNumber(d.dueDay),
				amount: d?.amount == null ? undefined : toFiniteNumber(d.amount),
				monthlyMinimum: d?.monthlyMinimum == null ? undefined : toFiniteNumber(d.monthlyMinimum),
				interestRate: d?.interestRate == null ? undefined : toFiniteNumber(d.interestRate),
			}))
			.filter((d) => d.name && d.currentBalance > 0)
		: [];

	if (debts.length === 0) return [];

	const tips: RecapTip[] = [];

	// 0) Credit limit vs upcoming card-funded obligations
	// If a debt's default payment source is "credit_card", paying it will increase the chosen card's balance.
	// Warn when the card doesn't have enough available credit for those upcoming charges.
	const cardDebts = debts.filter((d) =>
		(d.type === "credit_card" || d.type === "store_card") &&
		(d.creditLimit ?? 0) > 0 &&
		(d.currentBalance ?? 0) > 0 &&
		Boolean(d.id)
	);
	if (cardDebts.length > 0) {
		const plannedChargesByCardId = new Map<string, number>();
		for (const d of debts) {
			if (d.defaultPaymentSource !== "credit_card") continue;
			const cardId = String(d.defaultPaymentCardDebtId ?? "").trim();
			if (!cardId) continue;
			const due = toFiniteNumber(d.amount ?? 0);
			if (!(due > 0)) continue;
			plannedChargesByCardId.set(cardId, (plannedChargesByCardId.get(cardId) ?? 0) + due);
		}

		for (const card of cardDebts) {
			const limit = toFiniteNumber(card.creditLimit ?? 0);
			const available = limit - toFiniteNumber(card.currentBalance);
			const plannedCharges = plannedChargesByCardId.get(String(card.id)) ?? 0;

			if (limit > 0 && available < -0.005) {
				tips.push({
					title: "Card is over its credit limit",
					detail: `${card.name} looks over limit (available ${money(available)} on a ${money(limit)} limit). Consider paying it down to avoid fees / declined payments.`,
				});
				continue;
			}

			if (plannedCharges > 0 && available + 0.005 < plannedCharges) {
				tips.push({
					title: "Pay your card before upcoming charges",
					detail: `${card.name} has only ${money(available)} available, but you have ${money(plannedCharges)} planned to be charged to it (via other debt payments). Paying the card down first helps avoid going over limit / missed payments.`,
				});
			}
		}
	}

	const totalDebtBalance = debts.reduce((sum, d) => sum + d.currentBalance, 0);
	const plannedDebtPayment = debts.reduce((sum, d) => sum + (d.amount ?? 0), 0);
	const income = toFiniteNumber(args.totalIncome);
	const debtPaymentRatio = income > 0 ? plannedDebtPayment / income : 0;

	// 1) Minimum payment coverage
	const belowMinimum = debts
		.filter((d) => (d.monthlyMinimum ?? 0) > 0)
		.filter((d) => (d.amount ?? 0) > 0 && (d.amount ?? 0) + 0.005 < (d.monthlyMinimum ?? 0));
	if (belowMinimum.length > 0) {
		const d = belowMinimum[0];
		tips.push({
			title: "Cover minimum payments first",
			detail: `${d.name} is planned at ${money(d.amount ?? 0)} but the minimum is ${money(d.monthlyMinimum ?? 0)}. Paying at least the minimum helps avoid fees and credit damage.`,
		});
	}

	// 2) Interest rate data missing
	const hasAnyApr = debts.some((d) => (d.interestRate ?? 0) > 0);
	if (!hasAnyApr && debts.length >= 2) {
		tips.push({
			title: "Add APR to get smarter debt tips",
			detail: "If you add interest rates for each debt, this app can recommend an avalanche plan (highest APR first) and show which payoff saves the most interest.",
		});
	}

	// 3) Avalanche suggestion
	const byApr = debts
		.filter((d) => (d.interestRate ?? 0) > 0)
		.sort((a, b) => (b.interestRate ?? 0) - (a.interestRate ?? 0));
	if (byApr.length >= 2) {
		const top = byApr[0];
		tips.push({
			title: "Avalanche: prioritize the highest APR",
			detail: `${top.name} has the highest APR (${pct(top.interestRate ?? 0)}). Consider paying any extra on that first while keeping minimums on the rest.`,
		});
	}

	// 4) Snowball quick-win suggestion
	const closeToDone = debts
		.filter((d) => (d.amount ?? 0) > 0)
		.filter((d) => d.currentBalance > 0 && d.currentBalance <= 2 * (d.amount ?? 0))
		.sort((a, b) => a.currentBalance - b.currentBalance);
	if (closeToDone.length > 0) {
		const d = closeToDone[0];
		tips.push({
			title: "Quick win: close a small balance",
			detail: `${d.name} is close to paid off (${money(d.currentBalance)} left). Clearing it can free up ${money(d.amount ?? 0)}/month to roll into the next debt.`,
		});
	}

	// 5) Debt load awareness
	if (debtPaymentRatio >= 0.35 && plannedDebtPayment > 0 && income > 0) {
		tips.push({
			title: "Debt payments are a big chunk of income",
			detail: `Your planned debt payments are about ${pct(debtPaymentRatio * 100)} of income (${money(plannedDebtPayment)}/${money(income)}). If this feels tight, try reducing variable spending or temporarily pausing non-essential goals to protect minimum payments.`,
		});
	} else if (totalDebtBalance > 0 && plannedDebtPayment <= 0) {
		tips.push({
			title: "Set a monthly payment plan",
			detail: `You have ${money(totalDebtBalance)} in debt balance but no monthly debt amounts set. Add planned payments so the budget can reserve cash for debt.`,
		});
	}

	return clampTips(tips, 4);
}

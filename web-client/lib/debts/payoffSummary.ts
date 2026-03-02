export type DebtPayoffSummary = {
	cannotPayoff: boolean;
	payoffLabel: string | null;
	horizonLabel: string;
};

export function deriveDebtPayoffSummary(input: {
	computedMonthsLeft: number | null;
	computedPaidOffBy: string | null;
	maxMonths?: number;
}): DebtPayoffSummary {
	const maxMonths = Number.isFinite(input.maxMonths) ? Number(input.maxMonths) : 60;
	const monthsLeft = typeof input.computedMonthsLeft === "number"
		? Math.max(0, Math.trunc(input.computedMonthsLeft))
		: null;
	const cannotPayoff = monthsLeft == null;

	const payoffLabel = (() => {
		if (cannotPayoff || monthsLeft <= 0) return null;
		if (input.computedPaidOffBy) {
			const parsed = new Date(input.computedPaidOffBy);
			if (Number.isFinite(parsed.getTime())) {
				return parsed.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
			}
		}
		const payoffDate = new Date();
		payoffDate.setMonth(payoffDate.getMonth() + monthsLeft);
		return payoffDate.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
	})();

	const horizonLabel = cannotPayoff
		? `+${maxMonths} mo`
		: `+${monthsLeft} mo`;

	return {
		cannotPayoff,
		payoffLabel,
		horizonLabel,
	};
}
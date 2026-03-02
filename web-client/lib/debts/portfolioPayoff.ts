type PortfolioDebt = {
	paid: boolean;
	isActive: boolean;
	currentBalance: number;
	interestRate: number | null;
	computedMonthlyPayment: number;
};

export type PortfolioPayoffSummary = {
	monthsToClear: number | null;
	payoffLabel: string | null;
	horizonMonths: number;
};

export function computePortfolioPayoffSummary(input: {
	debts: PortfolioDebt[];
	totalMonthlyDebtPayments: number;
	maxMonthsCap?: number;
}): PortfolioPayoffSummary {
	const activeDebts = input.debts.filter((debt) => debt.isActive && !debt.paid);
	const monthlyTotal = Math.max(0, Number(input.totalMonthlyDebtPayments ?? 0));

	const estimateDebtMonths = (debt: PortfolioDebt): number | null => {
		if (debt.paid || debt.currentBalance <= 0) return 0;
		const rate = debt.interestRate ? debt.interestRate / 100 / 12 : 0;
		const pmt = debt.computedMonthlyPayment > 0
			? debt.computedMonthlyPayment
			: (monthlyTotal > 0 ? monthlyTotal / Math.max(activeDebts.length, 1) : 0);
		if (pmt <= 0) return null;

		let balance = debt.currentBalance;
		for (let month = 1; month <= 360; month += 1) {
			balance = rate > 0 ? balance * (1 + rate) - pmt : balance - pmt;
			if (balance <= 0) return month;
		}
		return null;
	};

	const projectedDebtMonths = activeDebts
		.map(estimateDebtMonths)
		.filter((months): months is number => months != null);
	const baseMaxMonths = projectedDebtMonths.length > 0 ? Math.max(...projectedDebtMonths) : 0;
	const maxMonths = Number.isFinite(input.maxMonthsCap)
		? Math.max(1, Math.trunc(input.maxMonthsCap as number))
		: 360;
	const horizon = Math.min(Math.max(baseMaxMonths + 2, 60), maxMonths);

	const projection: number[] = [];
	for (let month = 0; month <= horizon; month += 1) {
		let sum = 0;
		for (const debt of activeDebts) {
			if (debt.paid || debt.currentBalance <= 0) continue;
			const rate = debt.interestRate ? debt.interestRate / 100 / 12 : 0;
			const pmt = debt.computedMonthlyPayment > 0
				? debt.computedMonthlyPayment
				: (monthlyTotal / Math.max(activeDebts.length, 1));
			let balance = debt.currentBalance;
			for (let i = 0; i < month; i += 1) {
				if (balance <= 0) break;
				balance = rate > 0 ? balance * (1 + rate) - pmt : balance - pmt;
				balance = Math.max(0, balance);
			}
			sum += balance;
		}
		projection.push(Math.max(0, sum));
		if (sum <= 0) break;
	}

	const months = Math.max(0, projection.length - 1);
	const canProjectPayoff = projection.length > 0 && projection[projection.length - 1] <= 0;
	const monthsToClear = canProjectPayoff ? months : null;
	const payoffLabel = monthsToClear != null && monthsToClear > 0
		? (() => {
			const payoffDate = new Date();
			payoffDate.setMonth(payoffDate.getMonth() + monthsToClear);
			return payoffDate.toLocaleDateString("en-GB", { month: "short", year: "2-digit" });
		})()
		: null;

	return {
		monthsToClear,
		payoffLabel,
		horizonMonths: months,
	};
}
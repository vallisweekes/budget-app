import type { SpendingInsight } from "@/lib/ai/spendingInsights";

export type SpendingSource = "card" | "savings" | "allowance";

export interface SpendingEntryLike {
	description: string;
	amount: number;
	source: SpendingSource;
}

export interface AllowanceStatsLike {
	monthlyAllowance: number;
	totalUsed: number;
	remaining: number;
	percentUsed: number;
}

export function getFallbackSpendingInsights({
	spending,
	allowanceStats,
	savingsBalance,
}: {
	spending: SpendingEntryLike[];
	allowanceStats: AllowanceStatsLike;
	savingsBalance: number;
}): SpendingInsight[] {
	const insights: SpendingInsight[] = [];

	const bySource = spending.reduce(
		(acc, entry) => {
			acc[entry.source] = (acc[entry.source] || 0) + entry.amount;
			return acc;
		},
		{} as Record<SpendingSource, number>
	);

	const totalSpent = spending.reduce((sum, entry) => sum + entry.amount, 0);
	const avgTransaction = totalSpent / (spending.length || 1);

	if (allowanceStats.percentUsed > 80) {
		insights.push({
			type: "warning",
			title: allowanceStats.percentUsed >= 100 ? "Allowance Exceeded!" : "High Allowance Usage",
			message: `You've used ${allowanceStats.percentUsed.toFixed(0)}% of your monthly allowance (£${allowanceStats.totalUsed.toFixed(2)} of £${allowanceStats.monthlyAllowance.toFixed(2)}).`,
			recommendation:
				allowanceStats.percentUsed >= 100
					? "You've exceeded your budget. Consider using savings for essential purchases only."
					: "You're approaching your limit. Try to reduce discretionary spending for the rest of the period.",
			icon: "alert",
			color: "red",
		});
	} else if (allowanceStats.percentUsed > 50) {
		insights.push({
			type: "info",
			title: "Moderate Allowance Usage",
			message: `You've used ${allowanceStats.percentUsed.toFixed(0)}% of your monthly allowance. You're on track!`,
			recommendation: "Keep monitoring your spending to stay within budget.",
			icon: "lightbulb",
			color: "blue",
		});
	} else {
		insights.push({
			type: "success",
			title: "Great Budget Management!",
			message: `You've only used ${allowanceStats.percentUsed.toFixed(0)}% of your allowance. Well done!`,
			recommendation: "You're managing your budget excellently. Keep up the good work!",
			icon: "trendDown",
			color: "emerald",
		});
	}

	const primarySource = Object.entries(bySource).sort(([, a], [, b]) => b - a)[0];
	if (primarySource) {
		const [source, sourceAmount] = primarySource as [SpendingSource, number];
		const percentage = totalSpent > 0 ? (sourceAmount / totalSpent) * 100 : 0;

		let sourceMessage = "";
		let sourceRecommendation = "";

		if (source === "card" && percentage > 60) {
			sourceMessage = `${percentage.toFixed(0)}% of your spending (£${sourceAmount.toFixed(2)}) is on credit cards.`;
			sourceRecommendation = "High card usage increases debt. Try using allowance or savings for planned purchases.";
		} else if (source === "savings" && savingsBalance > 0 && sourceAmount > savingsBalance * 0.2) {
			sourceMessage = `You've spent £${sourceAmount.toFixed(2)} from savings, which is ${((sourceAmount / savingsBalance) * 100).toFixed(0)}% of your total savings.`;
			sourceRecommendation = "Be cautious with savings spending. Reserve savings for emergencies or major purchases.";
		} else if (source === "allowance") {
			sourceMessage = `Great! ${percentage.toFixed(0)}% of spending is from your allowance (£${sourceAmount.toFixed(2)}).`;
			sourceRecommendation = "Using your allowance is the best approach. This keeps you within your monthly budget.";
		}

		insights.push({
			type: source === "allowance" ? "success" : "info",
			title: "Spending Source Analysis",
			message: sourceMessage,
			recommendation: sourceRecommendation,
			icon: source === "allowance" ? "trendDown" : "trendUp",
			color: source === "allowance" ? "emerald" : source === "card" ? "orange" : "purple",
		} as SpendingInsight);
	}

	if (spending.length > 0) {
		const sortedByAmount = [...spending].sort((a, b) => b.amount - a.amount);
		const largestTransaction = sortedByAmount[0];

		if (largestTransaction.amount > avgTransaction * 2) {
			insights.push({
				type: "info",
				title: "Large Purchase Detected",
				message: `Your largest purchase was "${largestTransaction.description}" for £${largestTransaction.amount.toFixed(2)}.`,
				recommendation: "Consider planning large purchases in advance to better manage your budget.",
				icon: "alert",
				color: "amber",
			});
		}

		insights.push({
			type: "info",
			title: "Spending Frequency",
			message: `You've made ${spending.length} unplanned purchases with an average of £${avgTransaction.toFixed(2)} per transaction.`,
			recommendation:
				spending.length > 10
					? "You're making frequent small purchases. Try batching purchases to reduce impulse spending."
					: "You're keeping unplanned purchases under control. Great discipline!",
			icon: "lightbulb",
			color: "blue",
		});
	}

	return insights;
}

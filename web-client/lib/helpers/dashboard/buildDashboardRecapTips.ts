import { computeRecapTips, type DatedExpenseItem, type PreviousMonthRecap, type RecapTip } from "@/lib/expenses/insights";
import type { ExpenseItem } from "@/types";

type ForecastMonth = {
	year: number;
	monthNum: number;
	incomeTotal: number;
	billsTotal: number;
};

type RecapTipsContext = {
	year: number;
	monthNum: number;
	payDate: number;
	now?: Date;
};

function buildNeutralRecap(label: string): PreviousMonthRecap {
	return {
		label,
		totalCount: 0,
		totalAmount: 0,
		paidCount: 0,
		paidAmount: 0,
		partialCount: 0,
		partialAmount: 0,
		unpaidCount: 0,
		unpaidAmount: 0,
		missedDueCount: 0,
		missedDueAmount: 0,
	};
}

export function buildDashboardRecapTips(args: {
	recap: PreviousMonthRecap | null;
	shouldSuppressRecap: boolean;
	currentMonthExpenses: ExpenseItem[];
	ctx: RecapTipsContext;
	forecasts?: ForecastMonth[];
	historyExpenses?: DatedExpenseItem[];
}): RecapTip[] {
	const hasCurrentExpenseContext = Array.isArray(args.currentMonthExpenses) && args.currentMonthExpenses.length > 0;
	const recapForTips = args.recap ?? (
		args.shouldSuppressRecap && hasCurrentExpenseContext
			? buildNeutralRecap(`${args.ctx.year}-${args.ctx.monthNum}`)
			: null
	);

	if (!recapForTips) return [];

	return computeRecapTips({
		recap: recapForTips,
		currentMonthExpenses: args.currentMonthExpenses,
		ctx: args.ctx,
		forecasts: args.forecasts,
		historyExpenses: args.historyExpenses,
	});
}
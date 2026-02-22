import { currentMonthKey, monthKeyToNumber } from "@/lib/helpers/monthKey";
import type { MonthKey } from "@/types";

export function getIncomeMonthState(params: { year: number; month: MonthKey; now?: Date }) {
	const now = params.now ?? new Date();
	const currentYear = now.getFullYear();
	const nowMonth = currentMonthKey(now);
	const isCurrentMonth = params.year === currentYear && params.month === nowMonth;
	const isLocked =
		params.year < currentYear ||
		(params.year === currentYear && monthKeyToNumber(params.month) < monthKeyToNumber(nowMonth));

	return {
		currentYear,
		nowMonth,
		isCurrentMonth,
		isLocked,
		canAddForMonth: !isLocked,
	};
}

const MONTH_NAMES_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function clampDay(year: number, monthIndex: number, day: number) {
	const lastDay = new Date(year, monthIndex + 1, 0).getDate();
	return new Date(year, monthIndex, Math.min(Math.max(1, day), lastDay));
}

function formatRange(start: Date, end: Date): string {
	return `${start.getDate()} ${MONTH_NAMES_SHORT[start.getMonth()]} - ${end.getDate()} ${MONTH_NAMES_SHORT[end.getMonth()]}`;
}

export function getDashboardPayPeriodLabels(now: Date, payDate: number): {
	payPeriodLabel: string;
	previousPayPeriodLabel: string;
} {
	const safePayDate = Number.isFinite(payDate) && payDate >= 1 ? Math.floor(payDate) : 1;
	const thisMonthPayDate = clampDay(now.getFullYear(), now.getMonth(), safePayDate);
	const periodStart = now.getTime() >= thisMonthPayDate.getTime()
		? thisMonthPayDate
		: clampDay(now.getFullYear(), now.getMonth() - 1, safePayDate);
	const periodEnd = clampDay(periodStart.getFullYear(), periodStart.getMonth() + 1, safePayDate);
	periodEnd.setDate(periodEnd.getDate() - 1);

	const previousPeriodEnd = new Date(periodStart.getTime());
	previousPeriodEnd.setDate(previousPeriodEnd.getDate() - 1);
	const previousPeriodStart = clampDay(previousPeriodEnd.getFullYear(), previousPeriodEnd.getMonth() - 1, safePayDate);

	return {
		payPeriodLabel: formatRange(periodStart, periodEnd),
		previousPayPeriodLabel: formatRange(previousPeriodStart, previousPeriodEnd),
	};
}

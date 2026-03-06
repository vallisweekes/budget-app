import { resolveActivePayPeriodWindow } from "@/lib/payPeriods";

const MONTH_NAMES_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatRange(start: Date, end: Date): string {
	return `${start.getDate()} ${MONTH_NAMES_SHORT[start.getMonth()]} - ${end.getDate()} ${MONTH_NAMES_SHORT[end.getMonth()]}`;
}

export function getDashboardPayPeriodLabels(now: Date, payDate: number, planCreatedAt?: Date | null): {
	payPeriodLabel: string;
	previousPayPeriodLabel: string;
} {
	const safePayDate = Number.isFinite(payDate) && payDate >= 1 ? Math.floor(payDate) : 1;
	const currentWindow = resolveActivePayPeriodWindow({
		now,
		payDate: safePayDate,
		payFrequency: "monthly",
		planCreatedAt,
	});

	const previousPeriodEnd = new Date(currentWindow.start.getTime());
	previousPeriodEnd.setDate(previousPeriodEnd.getDate() - 1);
	const previousWindow = resolveActivePayPeriodWindow({
		now: previousPeriodEnd,
		payDate: safePayDate,
		payFrequency: "monthly",
	});

	return {
		payPeriodLabel: formatRange(currentWindow.start, currentWindow.end),
		previousPayPeriodLabel: formatRange(previousWindow.start, previousWindow.end),
	};
}

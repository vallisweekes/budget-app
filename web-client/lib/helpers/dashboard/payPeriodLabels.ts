import { formatPayPeriodLabelForFrequency, resolveActivePayPeriodWindow, type PayFrequency } from "@/lib/payPeriods";

export function getDashboardPayPeriodLabels(
	now: Date,
	payDate: number,
	payFrequency: PayFrequency = "monthly",
	payAnchorDate?: Date | string | null,
	planCreatedAt?: Date | null,
): {
	payPeriodLabel: string;
	previousPayPeriodLabel: string;
} {
	const safePayDate = Number.isFinite(payDate) && payDate >= 1 ? Math.floor(payDate) : 1;
	const currentWindow = resolveActivePayPeriodWindow({
		now,
		payDate: safePayDate,
		payFrequency,
		payAnchorDate,
		planCreatedAt,
	});

	const previousPeriodEnd = new Date(currentWindow.start.getTime());
	previousPeriodEnd.setDate(previousPeriodEnd.getDate() - 1);
	const previousWindow = resolveActivePayPeriodWindow({
		now: previousPeriodEnd,
		payDate: safePayDate,
		payFrequency,
		payAnchorDate,
	});

	return {
		payPeriodLabel: formatPayPeriodLabelForFrequency({
			start: currentWindow.start,
			end: currentWindow.end,
			payFrequency,
		}),
		previousPayPeriodLabel: formatPayPeriodLabelForFrequency({
			start: previousWindow.start,
			end: previousWindow.end,
			payFrequency,
		}),
	};
}

export const EARLY_PAYMENT_WINDOW_DAYS = 7;

export function getEarlyPaymentWindowStart(periodStart: Date): Date {
	return new Date(periodStart.getTime() - EARLY_PAYMENT_WINDOW_DAYS * 24 * 60 * 60 * 1000);
}

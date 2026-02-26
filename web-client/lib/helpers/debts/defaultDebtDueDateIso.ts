export function defaultDebtDueDateIso(payDate: number, now: Date = new Date()): string {
	const day = Number(payDate);
	if (!Number.isFinite(day) || day < 1 || day > 31) return "";

	const y = now.getUTCFullYear();
	const m = now.getUTCMonth();
	const daysInMonth = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
	let candidate = new Date(Date.UTC(y, m, Math.min(day, daysInMonth)));

	if (candidate.getTime() < now.getTime()) {
		const nextYear = candidate.getUTCFullYear();
		const nextMonth = candidate.getUTCMonth() + 1;
		const nextDaysInMonth = new Date(Date.UTC(nextYear, nextMonth + 1, 0)).getUTCDate();
		candidate = new Date(Date.UTC(nextYear, nextMonth, Math.min(day, nextDaysInMonth)));
	}

	return candidate.toISOString().slice(0, 10);
}

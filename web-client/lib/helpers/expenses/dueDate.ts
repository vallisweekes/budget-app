const dueDateFormatter = new Intl.DateTimeFormat("en-US", {
	month: "short",
	day: "numeric",
	timeZone: "UTC",
});

export function formatIsoDueDate(iso: string): string {
	// Expect YYYY-MM-DD. Parse as UTC to avoid timezone day shifts.
	const match = /^\d{4}-\d{2}-\d{2}$/.test(iso);
	if (!match) return iso;
	const [year, month, day] = iso.split("-").map((x) => Number(x));
	if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return iso;
	return dueDateFormatter.format(new Date(Date.UTC(year, month - 1, day)));
}

function clampDay(year: number, monthNumber: number, day: number): number {
	const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
	const safe = Number.isFinite(day) ? day : 1;
	return Math.min(Math.max(1, safe), lastDay);
}

export function getDueDateUtc(params: { year: number; monthNumber: number; dueDate?: string; payDate: number }): Date {
	const { year, monthNumber, dueDate, payDate } = params;
	if (dueDate && /^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
		const [y, m, d] = dueDate.split("-").map((x) => Number(x));
		if (Number.isFinite(y) && Number.isFinite(m) && Number.isFinite(d)) {
			return new Date(Date.UTC(y, m - 1, d));
		}
	}

	const day = clampDay(year, monthNumber, payDate);
	return new Date(Date.UTC(year, monthNumber - 1, day));
}

export function daysUntilUtc(dateUtc: Date): number {
	const now = new Date();
	const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
	const diff = dateUtc.getTime() - todayUtc.getTime();
	return Math.floor(diff / (1000 * 60 * 60 * 24));
}

export function ordinalSuffix(day: number): string {
	const mod10 = day % 10;
	const mod100 = day % 100;
	if (mod10 === 1 && mod100 !== 11) return `${day}st`;
	if (mod10 === 2 && mod100 !== 12) return `${day}nd`;
	if (mod10 === 3 && mod100 !== 13) return `${day}rd`;
	return `${day}th`;
}

export function formatDueDateLabel(days: number, dueDateUtc: Date): string {
	if (days === 0) return "Due Today";
	if (days < 0) return `Past Due ${Math.abs(days)}d`;
	const day = dueDateUtc.getUTCDate();
	return `Due on ${ordinalSuffix(day)}`;
}

export function dueBadgeClasses(daysUntilDue: number): string {
	// Requirements:
	// - green when > 10 days
	// - orange within 5 days
	// - red 1 day / today / overdue
	if (daysUntilDue <= 1) {
		return "bg-red-500/35 text-red-100 border border-red-400/50";
	}
	if (daysUntilDue <= 5) {
		return "bg-orange-500/35 text-orange-100 border border-orange-400/50";
	}
	if (daysUntilDue > 10) {
		return "bg-emerald-500/35 text-emerald-100 border border-emerald-400/50";
	}
	return "bg-yellow-500/35 text-yellow-100 border border-yellow-400/50";
}

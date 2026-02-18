export function addMonthsUtc(
	year: number,
	monthNum: number,
	delta: number
): { year: number; monthNum: number } {
	const d = new Date(Date.UTC(year, monthNum - 1 + delta, 1));
	return { year: d.getUTCFullYear(), monthNum: d.getUTCMonth() + 1 };
}

export function toNumber(value: unknown): number {
	if (typeof value === "number") return Number.isFinite(value) ? value : 0;
	if (typeof value === "string") {
		const n = Number(value);
		return Number.isFinite(n) ? n : 0;
	}
	if (value && typeof value === "object") {
		const str = (value as { toString: () => string }).toString();
		const n = Number(str);
		return Number.isFinite(n) ? n : 0;
	}
	return 0;
}

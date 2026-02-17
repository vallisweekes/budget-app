export function buildYears(baseYear: number, horizonYears: number): number[] {
	const safe = Number.isFinite(horizonYears) && horizonYears > 0 ? Math.floor(horizonYears) : 10;
	return Array.from({ length: safe }, (_, i) => baseYear + i);
}

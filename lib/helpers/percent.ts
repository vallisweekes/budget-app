export function percent(value: number): string {
	if (!Number.isFinite(value)) return "0%";
	return `${(value * 100).toFixed(0)}%`;
}

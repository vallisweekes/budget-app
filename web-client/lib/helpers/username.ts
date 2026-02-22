export function normalizeUsername(value: string): string {
	return String(value ?? "")
		.trim()
		.replace(/\s+/g, "-");
}

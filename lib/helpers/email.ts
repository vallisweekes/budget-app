export function normalizeEmail(value: string): string {
	return String(value ?? "")
		.trim()
		.toLowerCase();
}

// Pragmatic validator: rejects obvious invalid emails without aiming for full RFC coverage.
export function isValidEmail(value: string): boolean {
	const email = normalizeEmail(value);
	if (!email) return false;
	if (email.length > 254) return false;
	// Basic: local@domain.tld (no spaces, requires at least one dot in domain)
	return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

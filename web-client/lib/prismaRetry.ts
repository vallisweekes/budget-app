import "server-only";

type ErrorWithCode = { code?: unknown };

function hasCode(error: unknown): error is ErrorWithCode {
	return typeof error === "object" && error !== null && "code" in error;
}

export function isRetryableConnectionError(error: unknown): boolean {
	const code = hasCode(error) ? String(error.code ?? "") : "";
	const message = error instanceof Error ? error.message : String(error ?? "");
	return (
		code === "P1017" ||
		message.includes("Server has closed the connection") ||
		message.includes("Error in PostgreSQL connection") ||
		message.includes("kind: Closed") ||
		message.toLowerCase().includes("econnreset") ||
		message.toLowerCase().includes("connection terminated")
	);
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withPrismaRetry<T>(
	fn: () => Promise<T>,
	opts?: { retries?: number; delayMs?: number }
): Promise<T> {
	const retries = Math.max(0, opts?.retries ?? 1);
	const delayMs = Math.max(0, opts?.delayMs ?? 50);

	let lastError: unknown;
	for (let attempt = 0; attempt <= retries; attempt += 1) {
		try {
			return await fn();
		} catch (error) {
			lastError = error;
			if (attempt >= retries || !isRetryableConnectionError(error)) throw error;
			await sleep(delayMs);
		}
	}

	throw lastError;
}

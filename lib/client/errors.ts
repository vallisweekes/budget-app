export function getErrorMessage(err: unknown, fallback = "Something went wrong.") {
	if (err instanceof Error) return err.message || fallback;
	if (typeof err === "string" && err.trim()) return err;
	return fallback;
}

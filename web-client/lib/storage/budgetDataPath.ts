import path from "node:path";
import fs from "node:fs/promises";

function sanitizeSegment(segment: unknown) {
	// Prevent path traversal and weird filesystem edge-cases.
	if (typeof segment !== "string" || segment.trim().length === 0) {
		throw new Error("Invalid path segment (expected non-empty string)");
	}
	return segment.replace(/[^a-zA-Z0-9_.-]/g, "_");
}

export function getBudgetDataDir(budgetPlanId: string) {
	const safe = sanitizeSegment(budgetPlanId);
	return path.join(process.cwd(), "data", "budgets", safe);
}

export function getBudgetDataFilePath(budgetPlanId: string, filename: string) {
	const safeFile = sanitizeSegment(filename);
	return path.join(getBudgetDataDir(budgetPlanId), safeFile);
}

export async function ensureBudgetDataDir(budgetPlanId: string) {
	const dir = getBudgetDataDir(budgetPlanId);
	// Skip directory creation in production serverless environments
	if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
		return dir;
	}
	try {
		await fs.mkdir(dir, { recursive: true });
	} catch (error: any) {
		// Ignore errors in read-only environments
		if (error?.code !== 'ENOENT' && error?.code !== 'EROFS') {
			console.warn('Failed to create budget data directory:', error);
		}
	}
	return dir;
}

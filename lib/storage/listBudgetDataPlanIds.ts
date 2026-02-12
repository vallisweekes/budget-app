import fs from "node:fs/promises";
import path from "node:path";

export async function listBudgetDataPlanIds(): Promise<string[]> {
	const dir = path.join(process.cwd(), "data", "budgets");
	try {
		const entries = await fs.readdir(dir, { withFileTypes: true });
		return entries.filter((e) => e.isDirectory()).map((e) => e.name);
	} catch (e: any) {
		if (e?.code === "ENOENT") return [];
		throw e;
	}
}

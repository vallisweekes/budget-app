import fs from "node:fs/promises";
import path from "node:path";

export type PotKind = "allowance";

export interface Pot {
	id: string;
	name: string;
	kind: PotKind;
	createdAt: string;
}

function potsFilePath(budgetPlanId: string): string {
	const safe = String(budgetPlanId ?? "").trim();
	if (!safe) throw new Error("Missing budgetPlanId");
	return path.join(process.cwd(), "data", "pots", `${safe}.json`);
}

async function readJson<T>(p: string, fallback: T): Promise<T> {
	try {
		const buf = await fs.readFile(p);
		return JSON.parse(buf.toString());
	} catch (error: unknown) {
		const code =
			typeof error === "object" &&
			error != null &&
			"code" in error &&
			typeof (error as { code?: unknown }).code === "string"
				? (error as { code: string }).code
				: undefined;
		if (code === "ENOENT") return fallback;
		throw error;
	}
}

async function writeJson<T>(p: string, value: T) {
	await fs.mkdir(path.dirname(p), { recursive: true });
	await fs.writeFile(p, JSON.stringify(value, null, 2) + "\n");
}

export async function getAllPots(budgetPlanId: string, kind: PotKind = "allowance"): Promise<Pot[]> {
	const list = await readJson(potsFilePath(budgetPlanId), [] as Pot[]);
	return (list ?? []).filter((p) => p.kind === kind);
}

export async function createPot(budgetPlanId: string, input: { name: string; kind?: PotKind }): Promise<Pot> {
	const name = String(input.name ?? "").trim();
	if (!name) throw new Error("Pot name is required");
	const kind: PotKind = input.kind ?? "allowance";

	const filePath = potsFilePath(budgetPlanId);
	const list = await readJson(filePath, [] as Pot[]);
	const existing = list.find((p) => p.kind === kind && p.name.toLowerCase() === name.toLowerCase());
	if (existing) return existing;

	const pot: Pot = {
		id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
		name,
		kind,
		createdAt: new Date().toISOString(),
	};
	list.push(pot);
	await writeJson(filePath, list);
	return pot;
}

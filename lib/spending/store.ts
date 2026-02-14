import fs from "node:fs/promises";
import path from "node:path";

export interface SpendingEntry {
  id: string;
  description: string;
  amount: number;
  date: string;
  month: string;
  source: "card" | "savings" | "allowance";
  sourceId?: string; // card id if card
}

function spendingFilePath(budgetPlanId: string): string {
  const safe = String(budgetPlanId ?? "").trim();
  if (!safe) throw new Error("Missing budgetPlanId");
  return path.join(process.cwd(), "data", "spending", `${safe}.json`);
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

export async function getAllSpending(budgetPlanId: string): Promise<SpendingEntry[]> {
  return await readJson(spendingFilePath(budgetPlanId), []);
}

export async function addSpending(
  budgetPlanId: string,
  entry: Omit<SpendingEntry, "id">
): Promise<SpendingEntry> {
  const filePath = spendingFilePath(budgetPlanId);
  const list = await readJson(filePath, [] as SpendingEntry[]);
  const newEntry: SpendingEntry = {
    ...entry,
    id: Date.now().toString(),
  };
  list.push(newEntry);
  await writeJson(filePath, list);
  return newEntry;
}

export async function removeSpending(budgetPlanId: string, id: string): Promise<void> {
  const filePath = spendingFilePath(budgetPlanId);
  const list = await readJson(filePath, [] as SpendingEntry[]);
  const filtered = list.filter(e => e.id !== id);
  await writeJson(filePath, filtered);
}

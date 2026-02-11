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

const filePath = path.join(process.cwd(), "data", "spending.json");

async function readJson<T>(p: string, fallback: T): Promise<T> {
  try {
    const buf = await fs.readFile(p);
    return JSON.parse(buf.toString());
  } catch (e: any) {
    if (e?.code === "ENOENT") return fallback;
    throw e;
  }
}

async function writeJson<T>(p: string, value: T) {
  await fs.writeFile(p, JSON.stringify(value, null, 2) + "\n");
}

export async function getAllSpending(): Promise<SpendingEntry[]> {
  return await readJson(filePath, []);
}

export async function addSpending(entry: Omit<SpendingEntry, "id">): Promise<SpendingEntry> {
  const list = await getAllSpending();
  const newEntry: SpendingEntry = {
    ...entry,
    id: Date.now().toString(),
  };
  list.push(newEntry);
  await writeJson(filePath, list);
  return newEntry;
}

export async function removeSpending(id: string): Promise<void> {
  const list = await getAllSpending();
  const filtered = list.filter(e => e.id !== id);
  await writeJson(filePath, filtered);
}

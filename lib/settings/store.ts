import fs from "node:fs/promises";
import path from "node:path";

export interface Settings { 
  payDate: number;
  monthlyAllowance?: number;
  savingsBalance?: number;
}

const filePath = path.join(process.cwd(), "data", "settings.json");

export async function getSettings(): Promise<Settings> {
  try {
    const buf = await fs.readFile(filePath);
    return JSON.parse(buf.toString());
  } catch (e: any) {
    if (e?.code === "ENOENT") return { payDate: 27, monthlyAllowance: 0, savingsBalance: 0 };
    throw e;
  }
}

export async function saveSettings(s: Settings): Promise<void> {
  await fs.writeFile(filePath, JSON.stringify(s, null, 2) + "\n");
}

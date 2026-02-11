import fs from "node:fs/promises";
import path from "node:path";

export interface CategoryConfig {
  id: string;
  name: string;
  icon?: string; // emoji or URL
  featured?: boolean;
}

const filePath = path.join(process.cwd(), "data", "categories.json");

export async function getCategories(): Promise<CategoryConfig[]> {
  try {
    const buf = await fs.readFile(filePath);
    const list = JSON.parse(buf.toString());
    return Array.isArray(list) ? list : [];
  } catch (err: any) {
    if (err?.code === "ENOENT") return [];
    throw err;
  }
}

export async function saveCategories(list: CategoryConfig[]): Promise<void> {
  const content = JSON.stringify(list, null, 2) + "\n";
  await fs.writeFile(filePath, content);
}

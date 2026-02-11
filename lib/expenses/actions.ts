"use server";

import { revalidatePath } from "next/cache";
import { MonthKey } from "../budget/engine";
import { getAllExpenses } from "./store";
import fs from "node:fs/promises";
import path from "node:path";

const filePath = path.join(process.cwd(), "data", "expenses.monthly.json");

async function writeJson<T>(p: string, value: T) {
  await fs.writeFile(p, JSON.stringify(value, null, 2) + "\n");
}

export async function updatePaymentStatus(
  month: MonthKey,
  id: string,
  status: "paid" | "unpaid" | "partial",
  partialAmount?: number
): Promise<void> {
  const data = await getAllExpenses();
  const list = data[month];
  const idx = list.findIndex((e) => e.id === id);
  
  if (idx >= 0) {
    if (status === "paid") {
      list[idx].paid = true;
      list[idx].paidAmount = list[idx].amount;
    } else if (status === "unpaid") {
      list[idx].paid = false;
      list[idx].paidAmount = 0;
    } else if (status === "partial" && partialAmount !== undefined) {
      list[idx].paid = false;
      list[idx].paidAmount = partialAmount;
    }
  }
  
  await writeJson(filePath, data);
  revalidatePath("/");
  revalidatePath("/admin/expenses");
}

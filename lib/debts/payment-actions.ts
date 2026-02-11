"use server";

import { revalidatePath } from "next/cache";
import { getAllDebts } from "./store";
import fs from "node:fs/promises";
import path from "node:path";
import type { PaymentStatus } from "@/types";

const filePath = path.join(process.cwd(), "data", "debts.json");

async function writeJson<T>(p: string, value: T) {
  await fs.writeFile(p, JSON.stringify(value, null, 2) + "\n");
}

export async function updateDebtPaymentStatus(
  month: string,
  id: string,
  status: PaymentStatus,
  partialAmount?: number
): Promise<void> {
  const debts = getAllDebts();
  const idx = debts.findIndex((d) => d.id === id);
  
  if (idx >= 0) {
    const debt = debts[idx];
    if (status === "paid") {
      debts[idx].paid = true;
      debts[idx].paidAmount = debt.initialBalance;
      debts[idx].currentBalance = 0;
    } else if (status === "unpaid") {
      debts[idx].paid = false;
      debts[idx].paidAmount = 0;
      debts[idx].currentBalance = debt.initialBalance;
    } else if (status === "partial" && partialAmount !== undefined) {
      debts[idx].paid = false;
      debts[idx].paidAmount = partialAmount;
      debts[idx].currentBalance = Math.max(0, debt.initialBalance - partialAmount);
    }
  }
  
  await writeJson(filePath, debts);
  revalidatePath("/");
  revalidatePath("/admin/debts");
}

"use server";

import { saveSettings } from "../../../lib/settings/store";
import { addIncome, updateIncome, removeIncome } from "../../../lib/income/store";
import { MonthKey } from "../../../lib/budget/engine";

export async function saveSettingsAction(formData: FormData): Promise<void> {
  const payDate = Number(formData.get("payDate") || 27);
  const monthlyAllowance = Number(formData.get("monthlyAllowance") || 0);
  const savingsBalance = Number(formData.get("savingsBalance") || 0);
  await saveSettings({ 
    payDate: Math.max(1, Math.min(31, payDate)),
    monthlyAllowance,
    savingsBalance
  });
}

export async function addIncomeAction(formData: FormData): Promise<void> {
  const month = String(formData.get("month")) as MonthKey;
  const name = String(formData.get("name") || "").trim();
  const amount = Number(formData.get("amount") || 0);
  if (!name || !month) return;
  await addIncome(month, { name, amount });
}

export async function updateIncomeAction(month: MonthKey, id: string, name: string, amount: number): Promise<void> {
  if (!name.trim()) return;
  await updateIncome(month, id, { name: name.trim(), amount });
}

export async function removeIncomeAction(month: MonthKey, id: string): Promise<void> {
  await removeIncome(month, id);
}

"use server";

import { revalidatePath } from "next/cache";
import { addSpending, removeSpending, getAllSpending } from "./store";
import { getSettings, saveSettings } from "@/lib/settings/store";
import { updateDebt, getDebtById } from "@/lib/debts/store";
import { getMonthlyAllocationSnapshot } from "@/lib/allocations/store";
import { monthNumberToKey } from "@/lib/helpers/monthKey";
import { createPot } from "@/lib/pots/store";
import { resolveBudgetPlanPayPeriodContext } from "@/lib/api/payPeriodContext";

function requireBudgetPlanId(formData: FormData): string {
  const raw = formData.get("budgetPlanId");
  const budgetPlanId = String(raw ?? "").trim();
  if (!budgetPlanId) throw new Error("Missing budgetPlanId");
  return budgetPlanId;
}

function toInclusivePeriodWindow(window: { start: Date; end: Date }): { start: Date; end: Date; periodMonth: string } {
  const start = new Date(window.start.getTime());
  start.setUTCHours(0, 0, 0, 0);

  const end = new Date(window.end.getTime());
  end.setUTCHours(23, 59, 59, 999);

  const periodMonth = start.toLocaleString("en-GB", { month: "long", timeZone: "UTC" }).toUpperCase();

  return { start, end, periodMonth };
}

export async function addSpendingAction(formData: FormData) {
	const budgetPlanId = requireBudgetPlanId(formData);
  const description = formData.get("description") as string;
  const amount = parseFloat(formData.get("amount") as string);
  const source = formData.get("source") as "card" | "savings" | "allowance";
  const sourceId = formData.get("sourceId") as string;
  const potIdRaw = String(formData.get("potId") ?? "").trim();
  const newPotNameRaw = String(formData.get("newPotName") ?? "").trim();
  const month = formData.get("month") as string;

  if (!description || isNaN(amount) || amount <= 0) {
    return { error: "Invalid input" };
  }

  const settings = await getSettings(budgetPlanId);
  const now = new Date();
  const payPeriodContext = await resolveBudgetPlanPayPeriodContext({ budgetPlanId, now });

  let potId: string | undefined = potIdRaw || undefined;
  if (source === "allowance") {
    if (newPotNameRaw) {
      const pot = await createPot(budgetPlanId, { name: newPotNameRaw, kind: "allowance" });
      potId = pot.id;
    }
    // If the client sent the sentinel, ignore it.
    if (potId === "__new__") potId = undefined;
  } else {
    potId = undefined;
  }

  // Handle allowance tracking by pay period
  if (source === "allowance") {
    const payPeriod = toInclusivePeriodWindow(payPeriodContext.window);
    const allocationMonthKey = monthNumberToKey(payPeriod.start.getUTCMonth() + 1);
    const allocation = await getMonthlyAllocationSnapshot(budgetPlanId, allocationMonthKey, {
		year: payPeriod.start.getUTCFullYear(),
	});
    const monthlyAllowance = allocation.monthlyAllowance || settings.monthlyAllowance || 0;
    
    const allSpending = await getAllSpending(budgetPlanId);
    // Filter spending within the current pay period
    const allowanceSpending = allSpending.filter(e => {
      if (e.source !== "allowance") return false;
      const spendingDate = new Date(e.date);
      return spendingDate >= payPeriod.start && spendingDate <= payPeriod.end;
    });
    
    const totalAllowanceUsed = allowanceSpending.reduce((sum, e) => sum + e.amount, 0);
    const remainingAllowance = monthlyAllowance - totalAllowanceUsed;
    
    if (amount > remainingAllowance) {
      return { 
        error: "Warning",
        message: `You are spending £${amount.toFixed(2)} but only have £${remainingAllowance.toFixed(2)} remaining in your current allowance period (£${monthlyAllowance} total, period: ${payPeriod.periodMonth} ${payPeriod.start.getUTCDate()} - ${payPeriod.end.toLocaleString("en-GB", { month: "long", timeZone: "UTC" })} ${payPeriod.end.getUTCDate()}). You will exceed your allowance by £${(amount - remainingAllowance).toFixed(2)}.`
      };
    }
  }

  // Handle savings reduction
  if (source === "savings") {
    const currentSavings = settings.savingsBalance || 0;
    if (amount > currentSavings) {
      return { 
        error: "Insufficient savings",
        message: `You only have £${currentSavings.toFixed(2)} in savings but are trying to spend £${amount.toFixed(2)}.`
      };
    }
    await saveSettings(budgetPlanId, { savingsBalance: currentSavings - amount });
  }

  // Handle card balance increase
  if (source === "card" && sourceId) {
		const debt = await getDebtById(budgetPlanId, sourceId);
    if (debt) {
      const newBalance = debt.currentBalance + amount;
			await updateDebt(budgetPlanId, sourceId, { currentBalance: newBalance });
    }
  }

  await addSpending(budgetPlanId, {
    description,
    amount,
    date: new Date().toISOString(),
    month,
    source,
    sourceId: sourceId || undefined,
    potId,
  });

  revalidatePath("/admin/spending");
  revalidatePath("/");
  return { success: true };
}

export async function removeSpendingAction(id: string): Promise<void>;
export async function removeSpendingAction(budgetPlanId: string, id: string): Promise<void>;
export async function removeSpendingAction(a: string, b?: string) {
  const budgetPlanId = b ? a : "";
  const id = b ?? a;
  if (!budgetPlanId) throw new Error("Missing budgetPlanId");
  await removeSpending(budgetPlanId, id);
  revalidatePath("/admin/spending");
  revalidatePath("/");
}

export async function getSpendingForMonth(budgetPlanId: string, month: string) {
  const allSpending = await getAllSpending(budgetPlanId);
  return allSpending.filter(e => e.month === month);
}

export async function getAllowanceStats(month: string, budgetPlanId: string) {
  const settings = await getSettings(budgetPlanId);
  const [yearStr, monthStr] = String(month ?? "").split("-");
  const parsedYear = Number(yearStr);
  const parsedMonth = Number(monthStr);
  const baseDate =
    Number.isFinite(parsedYear) && Number.isFinite(parsedMonth)
      ? new Date(parsedYear, Math.max(0, Math.min(11, parsedMonth - 1)), 15)
      : new Date();

  const payPeriodContext = await resolveBudgetPlanPayPeriodContext({ budgetPlanId, now: baseDate });
  const payPeriod = toInclusivePeriodWindow(payPeriodContext.window);
  const allocationMonthKey = monthNumberToKey(payPeriod.start.getUTCMonth() + 1);
  const allocation = await getMonthlyAllocationSnapshot(budgetPlanId, allocationMonthKey, {
		year: payPeriod.start.getUTCFullYear(),
	});
  const monthlyAllowance = allocation.monthlyAllowance || settings.monthlyAllowance || 0;
  
  const allSpending = await getAllSpending(budgetPlanId);
  // Filter spending within the current pay period (not calendar month)
  const allowanceSpending = allSpending.filter(e => {
    if (e.source !== "allowance") return false;
    const spendingDate = new Date(e.date);
    return spendingDate >= payPeriod.start && spendingDate <= payPeriod.end;
  });
  
  const totalUsed = allowanceSpending.reduce((sum, e) => sum + e.amount, 0);
  const remaining = monthlyAllowance - totalUsed;
  
  return {
    monthlyAllowance,
    totalUsed,
    remaining,
    percentUsed: monthlyAllowance > 0 ? (totalUsed / monthlyAllowance) * 100 : 0,
    periodStart: payPeriod.start.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" }),
    periodEnd: payPeriod.end.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" }),
    periodMonth: payPeriod.periodMonth
  };
}

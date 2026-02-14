"use server";

import { revalidatePath } from "next/cache";
import { addSpending, removeSpending, getAllSpending } from "./store";
import { getSettings, saveSettings } from "@/lib/settings/store";
import { updateDebt, getDebtById } from "@/lib/debts/store";

function requireBudgetPlanId(formData: FormData): string {
  const raw = formData.get("budgetPlanId");
  const budgetPlanId = String(raw ?? "").trim();
  if (!budgetPlanId) throw new Error("Missing budgetPlanId");
  return budgetPlanId;
}

// Helper to get the pay period for a given date
function getPayPeriod(date: Date, payDate: number): { start: Date; end: Date; periodMonth: string } {
  const currentDay = date.getDate();
  const currentMonth = date.getMonth();
  const currentYear = date.getFullYear();
  
  let periodStartMonth: number;
  let periodStartYear: number;
  
  if (currentDay >= payDate) {
    // We're after the pay date this month, so period started this month
    periodStartMonth = currentMonth;
    periodStartYear = currentYear;
  } else {
    // We're before the pay date this month, so period started last month
    periodStartMonth = currentMonth - 1;
    periodStartYear = currentYear;
    if (periodStartMonth < 0) {
      periodStartMonth = 11;
      periodStartYear--;
    }
  }
  
  const start = new Date(periodStartYear, periodStartMonth, payDate);
  const end = new Date(periodStartYear, periodStartMonth + 1, payDate - 1);
  
  const monthNames = ["JANUARY", "FEBURARY", "MARCH", "APRIL", "MAY", "JUNE", "JULY", "AUGUST ", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"];
  const periodMonth = monthNames[periodStartMonth];
  
  return { start, end, periodMonth };
}

export async function addSpendingAction(formData: FormData) {
	const budgetPlanId = requireBudgetPlanId(formData);
  const description = formData.get("description") as string;
  const amount = parseFloat(formData.get("amount") as string);
  const source = formData.get("source") as "card" | "savings" | "allowance";
  const sourceId = formData.get("sourceId") as string;
  const month = formData.get("month") as string;

  if (!description || isNaN(amount) || amount <= 0) {
    return { error: "Invalid input" };
  }

  const settings = await getSettings(budgetPlanId);
  const now = new Date();

  // Handle allowance tracking by pay period
  if (source === "allowance") {
    const monthlyAllowance = settings.monthlyAllowance || 0;
    const payPeriod = getPayPeriod(now, settings.payDate);
    
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
        message: `You are spending £${amount.toFixed(2)} but only have £${remainingAllowance.toFixed(2)} remaining in your current allowance period (£${monthlyAllowance} total, period: ${payPeriod.periodMonth} ${payPeriod.start.getDate()} - ${payPeriod.end.toLocaleString('default', { month: 'long' })} ${payPeriod.end.getDate()}). You will exceed your allowance by £${(amount - remainingAllowance).toFixed(2)}.`
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
  const monthlyAllowance = settings.monthlyAllowance || 0;
  const now = new Date();
  const payPeriod = getPayPeriod(now, settings.payDate);
  
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
    periodStart: payPeriod.start.toLocaleDateString(),
    periodEnd: payPeriod.end.toLocaleDateString(),
    periodMonth: payPeriod.periodMonth
  };
}

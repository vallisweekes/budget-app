import type { DebtSummaryItem } from "@/lib/apiTypes";
import { T } from "@/lib/theme";

export const TYPE_COLORS: Record<string, string> = {
  credit_card: "#e25c5c",
  store_card: "#f4a942",
  loan: "#a78bfa",
  mortgage: "#38bdf8",
  hire_purchase: "#f4a942",
  other: "#64748b",
};

export function assignDebtColors(debts: DebtSummaryItem[]): string[] {
  const palette = [
    "#e25c5c", "#f4a942", "#a78bfa", "#38bdf8", "#34d399",
    "#fb923c", "#f472b6", "#60a5fa", "#facc15", "#4ade80",
  ];
  const used: Record<string, number> = {};

  return debts.map((debt) => {
    const base = TYPE_COLORS[debt.type] ?? T.accent;
    const count = used[base] ?? 0;
    used[base] = count + 1;
    if (count === 0) return base;
    const baseIndex = palette.indexOf(base);
    return palette[(baseIndex + count * 2) % palette.length];
  });
}

export function projectDebtMonths(debt: DebtSummaryItem, totalMonthly: number): number {
  const rate = debt.interestRate ? debt.interestRate / 100 / 12 : 0;
  const payment = debt.computedMonthlyPayment > 0
    ? debt.computedMonthlyPayment
    : totalMonthly > 0
    ? totalMonthly
    : debt.currentBalance / 24;

  let balance = debt.currentBalance;
  for (let month = 1; month <= 360; month += 1) {
    balance = rate > 0 ? balance * (1 + rate) - payment : balance - payment;
    if (balance <= 0) return month;
  }
  return 360;
}

export function payoffDateLabel(months: number): string {
  const date = new Date();
  date.setMonth(date.getMonth() + months);
  return date.toLocaleDateString("en-GB", { month: "short", year: "2-digit" });
}

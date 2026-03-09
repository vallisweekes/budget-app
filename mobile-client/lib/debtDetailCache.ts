import type { CreditCard, DebtSummaryData, DebtSummaryItem } from "@/lib/apiTypes";

let debtSummaryById = new Map<string, DebtSummaryItem>();
let cachedCreditCards: CreditCard[] = [];

export function setCachedDebtListData(summary: DebtSummaryData | null, cards: CreditCard[] | null | undefined) {
  debtSummaryById = new Map((summary?.debts ?? []).map((debt) => [debt.id, debt]));
  cachedCreditCards = Array.isArray(cards) ? [...cards] : [];
}

export function getCachedDebtSummaryItem(debtId: string): DebtSummaryItem | null {
  return debtSummaryById.get(debtId) ?? null;
}

export function getCachedDebtCreditCards(): CreditCard[] {
  return [...cachedCreditCards];
}

export function clearCachedDebtListData() {
  debtSummaryById = new Map();
  cachedCreditCards = [];
}
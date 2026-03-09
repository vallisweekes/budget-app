import { useMemo } from "react";

import type { Debt } from "@/lib/apiTypes";

export type DebtGroupKey = "credit_card" | "loan" | "hire_purchase" | "other";

export const DEBT_GROUP_META: Array<{ key: DebtGroupKey; label: string; icon: "card-outline" | "document-text-outline" | "car-outline" | "layers-outline" }> = [
  { key: "credit_card", label: "Credit Cards", icon: "card-outline" },
  { key: "loan", label: "Loans", icon: "document-text-outline" },
  { key: "hire_purchase", label: "Hire Purchase", icon: "car-outline" },
  { key: "other", label: "Other", icon: "layers-outline" },
];

function toDebtGroupKey(type: string | null | undefined): DebtGroupKey {
  if (type === "credit_card" || type === "loan" || type === "hire_purchase") return type;
  return "other";
}

function isMissedPaymentDebt(debt: Debt): boolean {
  return debt.isMissedPayment === true || debt.sourceType === "expense";
}

export function useSettingsDebtBuckets(debts: Debt[]) {
  return useMemo(() => {
    const regularDebts = debts.filter((debt) => !isMissedPaymentDebt(debt));
    const missedPaymentDebts = debts.filter((debt) => isMissedPaymentDebt(debt));

    const map: Record<DebtGroupKey, Debt[]> = {
      credit_card: [],
      loan: [],
      hire_purchase: [],
      other: [],
    };

    for (const debt of regularDebts) {
      map[toDebtGroupKey(debt.type)].push(debt);
    }

    const groupedDebts = DEBT_GROUP_META
      .map((meta) => ({ ...meta, items: map[meta.key] }))
      .filter((group) => group.items.length > 0);

    return {
      groupedDebts,
      missedPaymentDebts,
    };
  }, [debts]);
}

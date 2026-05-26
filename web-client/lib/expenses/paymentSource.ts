import { enforceServerOnlyRuntime } from "@/lib/serverOnly";

enforceServerOnlyRuntime();

export type ClientExpenseFundingSource = "income" | "credit_card" | "savings" | "emergency" | "loan" | "other";

export function isCreditLikeDebtType(value: unknown): boolean {
  return value === "credit_card" || value === "store_card";
}

export function isLoanLikeDebtType(value: unknown): boolean {
  return value === "loan";
}

export function toClientExpenseFundingSource(params: {
  paymentSource: unknown;
  selectedDebtType?: unknown;
}): ClientExpenseFundingSource {
  const source = String(params.paymentSource ?? "").trim().toLowerCase();
  if (source === "credit_card") return "credit_card";
  if (source === "savings") return "savings";
  if (source === "emergency") return "emergency";
  if (source === "extra_untracked") {
    return isLoanLikeDebtType(params.selectedDebtType) ? "loan" : "other";
  }
  return "income";
}
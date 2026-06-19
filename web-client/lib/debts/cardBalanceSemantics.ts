function toNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);
  if (value && typeof value === "object") {
    const maybe = value as { toNumber?: () => unknown; toString?: () => unknown };
    if (typeof maybe.toNumber === "function") return Number(maybe.toNumber());
    if (typeof maybe.toString === "function") return Number(maybe.toString());
  }
  return Number(value);
}

function roundMoney(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}

export function normalizeCreditLikeCurrentBalance(params: {
  type?: string | null;
  currentBalance?: unknown;
  creditLimit?: unknown;
  trackedExpenseCharges?: unknown;
  trackedDebtCharges?: unknown;
  trackedPayments?: unknown;
}): number {
  const type = String(params.type ?? "").trim();
  if (type !== "credit_card" && type !== "store_card") {
    return roundMoney(Math.max(0, toNumber(params.currentBalance)));
  }

  const currentBalance = roundMoney(Math.max(0, toNumber(params.currentBalance)));
  const creditLimit = Math.max(0, toNumber(params.creditLimit));
  if (!(creditLimit > 0) || !(currentBalance >= creditLimit)) {
    return currentBalance;
  }

  const trackedExpenseCharges = Math.max(0, toNumber(params.trackedExpenseCharges));
  const trackedDebtCharges = Math.max(0, toNumber(params.trackedDebtCharges));
  const trackedPayments = Math.max(0, toNumber(params.trackedPayments));
  const trackedOutstanding = roundMoney(Math.max(0, trackedExpenseCharges + trackedDebtCharges - trackedPayments));

  if (!(trackedOutstanding > 0)) {
    if (Math.abs(currentBalance - creditLimit) <= 0.01) {
      return 0;
    }
    return currentBalance;
  }

  const offsetAdjusted = roundMoney(Math.max(0, currentBalance - creditLimit));
  const offsetDistance = Math.abs(offsetAdjusted - trackedOutstanding);
  const storedDistance = Math.abs(currentBalance - trackedOutstanding);

  return roundMoney(offsetDistance + 0.01 < storedDistance ? offsetAdjusted : currentBalance);
}
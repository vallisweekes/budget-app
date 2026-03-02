export function formatIncomePct(value: number, grossIncome: number): string {
  if (!grossIncome || grossIncome <= 0) return "0.0%";
  return `${((value / grossIncome) * 100).toFixed(1)}%`;
}

export function computeMoneyLeftVsLastMonth(
  previousMoneyLeftAfterPlan: number | null | undefined,
  moneyLeftAfterPlan: number | null | undefined,
): number | null {
  const previous = Number(previousMoneyLeftAfterPlan ?? 0);
  const current = Number(moneyLeftAfterPlan ?? 0);
  if (!Number.isFinite(previous) || previous === 0) return null;

  const change = ((current - previous) / Math.abs(previous)) * 100;
  return Number.isFinite(change) ? change : null;
}

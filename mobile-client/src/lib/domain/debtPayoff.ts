export function buildProjection(balance: number, monthlyPayment: number, monthlyRate: number, maxMonths = 60): number[] {
  const points: number[] = [balance];
  let current = balance;

  for (let index = 0; index < maxMonths; index += 1) {
    if (current <= 0) break;
    current = monthlyRate > 0 ? current * (1 + monthlyRate) - monthlyPayment : current - monthlyPayment;
    current = Math.max(0, current);
    points.push(current);
    if (current === 0) break;
  }

  return points;
}

type PayoffSummaryArgs = {
  points: number[];
  monthlyPayment: number;
  monthsLeftOverride?: number | null;
  paidOffByOverride?: string | null;
};

export function derivePayoffSummary({
  points,
  monthlyPayment,
  monthsLeftOverride,
  paidOffByOverride,
}: PayoffSummaryArgs): {
  totalMonthsComputed: number;
  totalMonths: number;
  cannotPayoff: boolean;
  payoffLabel: string | null;
  horizonLabel: string;
} {
  const totalMonthsComputed = points.length - 1;
  const totalMonths = monthsLeftOverride != null ? Math.max(0, monthsLeftOverride) : totalMonthsComputed;
  const cannotPayoff = monthsLeftOverride === null ? true : monthlyPayment === 0 || points[points.length - 1] > 0;

  const payoffLabel = (() => {
    if (cannotPayoff || totalMonths <= 0) return null;
    if (paidOffByOverride) {
      const parsed = new Date(paidOffByOverride);
      if (Number.isFinite(parsed.getTime())) {
        return parsed.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
      }
    }
    const payoffDate = new Date();
    payoffDate.setMonth(payoffDate.getMonth() + totalMonths);
    return payoffDate.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
  })();

  const horizonLabel = cannotPayoff ? `+${totalMonthsComputed} mo` : `+${totalMonths} mo`;
  return { totalMonthsComputed, totalMonths, cannotPayoff, payoffLabel, horizonLabel };
}

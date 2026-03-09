import type { DebtSummaryData, DebtSummaryItem } from "@/lib/apiTypes";
import { getApiBaseUrl } from "@/lib/api";
import { payoffDateLabel, TYPE_COLORS } from "@/lib/helpers/debtAnalytics";

export { TYPE_COLORS };

export const TYPE_LABELS: Record<string, string> = {
  credit_card: "Credit Card",
  store_card: "Store Card",
  loan: "Loan",
  mortgage: "Mortgage",
  hire_purchase: "Hire Purchase",
  other: "Other",
};

export const TERM_PRESETS = [2, 3, 6, 12, 24, 36, 48] as const;

export const PAYMENT_SOURCE_OPTIONS = [
  { value: "income", label: "Income" },
  { value: "extra_funds", label: "Extra funds" },
  { value: "credit_card", label: "Card" },
] as const;

export function resolveLogoUri(raw: string | null | undefined): string | null {
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  if (!raw.startsWith("/")) return null;
  try {
    return `${getApiBaseUrl()}${raw}`;
  } catch {
    return null;
  }
}

export function formatYmdToDmy(ymd: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!match) return ymd;
  return `${match[3]}/${match[2]}/${match[1]}`;
}

export function parseInstallmentMonthlyPayment(balanceRaw: string, monthsRaw: string): string | null {
  const months = Number.parseInt(monthsRaw.trim(), 10);
  if (!Number.isFinite(months) || months <= 0) return null;

  const balance = Number.parseFloat(balanceRaw.trim());
  if (!Number.isFinite(balance) || balance < 0) return null;

  const monthly = balance / months;
  if (!Number.isFinite(monthly)) return null;
  return (Math.ceil(monthly * 100) / 100).toFixed(2);
}

function estimateDebtMonths(debt: DebtSummaryItem, totalMonthly: number, activeDebtCount: number): number | null {
  if (debt.paid || debt.currentBalance <= 0) return 0;
  const rate = debt.interestRate ? debt.interestRate / 100 / 12 : 0;
  const payment = debt.computedMonthlyPayment > 0
    ? debt.computedMonthlyPayment
    : totalMonthly > 0
      ? totalMonthly / Math.max(activeDebtCount, 1)
      : 0;

  if (payment <= 0) return null;

  let balance = debt.currentBalance;
  for (let month = 1; month <= 360; month += 1) {
    balance = rate > 0 ? balance * (1 + rate) - payment : balance - payment;
    if (balance <= 0) return month;
  }

  return null;
}

export function buildDebtProjectionSummary(params: {
  activeDebts: DebtSummaryItem[];
  summary: DebtSummaryData | null;
  selectedProjectionMonth: number | null;
}) {
  const { activeDebts, summary, selectedProjectionMonth } = params;
  const total = summary?.totalDebtBalance ?? 0;
  const monthly = summary?.totalMonthlyDebtPayments ?? 0;
  const highestAPR = activeDebts
    .filter((debt) => debt.interestRate != null && debt.interestRate > 0)
    .sort((a, b) => (b.interestRate ?? 0) - (a.interestRate ?? 0))[0];

  const projectedDebtMonths = activeDebts
    .map((debt) => estimateDebtMonths(debt, monthly, activeDebts.length))
    .filter((value): value is number => value != null);

  const baseMaxMonths = projectedDebtMonths.length > 0 ? Math.max(...projectedDebtMonths) : 0;
  const maxMonths = Math.min(Math.max(baseMaxMonths + 2, 60), 360);
  const projection: number[] = [];

  for (let month = 0; month <= maxMonths; month += 1) {
    let sum = 0;

    for (const debt of activeDebts) {
      if (debt.paid || debt.currentBalance <= 0) continue;

      const rate = debt.interestRate ? debt.interestRate / 100 / 12 : 0;
      const payment = debt.computedMonthlyPayment > 0
        ? debt.computedMonthlyPayment
        : monthly / Math.max(activeDebts.length, 1);

      let balance = debt.currentBalance;
      for (let index = 0; index < month; index += 1) {
        if (balance <= 0) break;
        balance = rate > 0 ? balance * (1 + rate) - payment : balance - payment;
        balance = Math.max(0, balance);
      }

      sum += balance;
    }

    projection.push(Math.max(0, sum));
    if (sum <= 0) break;
  }

  const months = Math.max(0, projection.length - 1);
  const canProjectPayoff = projection.length > 0 && projection[projection.length - 1] <= 0;
  const monthsToClear = summary?.payoffSummary?.monthsToClear ?? (canProjectPayoff ? months : null);
  const payoffLabel = (() => {
    if (summary?.payoffSummary?.payoffLabel) return summary.payoffSummary.payoffLabel;
    if (monthsToClear == null || monthsToClear <= 0) return "";
    return payoffDateLabel(monthsToClear);
  })();
  const milestoneMonths = [6, 12, 24].filter((month) => month > 0 && month < months);
  const selectedMonth =
    selectedProjectionMonth != null && selectedProjectionMonth >= 1 && selectedProjectionMonth <= months
      ? selectedProjectionMonth
      : Math.max(1, Math.floor(months * 0.28));

  return {
    highestAPR,
    milestoneMonths,
    monthly,
    months,
    monthsToClear,
    payoffLabel,
    projection,
    selectedMonth,
    selectedValue: projection[selectedMonth] ?? 0,
    total,
  };
}

export function projectionMonthLabel(month: number): string {
  return month === 12 ? "1y" : month === 24 ? "2y" : `${month}m`;
}
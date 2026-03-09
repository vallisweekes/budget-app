import { fmt } from "@/lib/formatting";
import { buildPayPeriodFromMonthAnchor, formatPayPeriodLabel } from "@/lib/payPeriods";
import type {
  AnalyticsAnchor,
  AnalyticsChartData,
  AnalyticsDebtDistributionItem,
  AnalyticsDerivedInput,
  AnalyticsInsightRow,
  AnalyticsOverviewMode,
  AnalyticsTopTip,
} from "@/types/AnalyticsScreen.types";

export const MONTH_SHORT = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
export const OVERVIEW_CHART_H = 180;

export function getAnalyticsMonthLabel(date: Date): string {
  return MONTH_SHORT[date.getMonth()] ?? "THIS MONTH";
}

export function getActiveAnalyticsAnchor(monthNum?: number | null, year?: number | null): AnalyticsAnchor {
  return {
    month: Number.isFinite(monthNum) ? Number(monthNum) : new Date().getMonth() + 1,
    year: Number.isFinite(year) ? Number(year) : new Date().getFullYear(),
  };
}

export function getPreviousAnalyticsAnchor(activeAnchor: AnalyticsAnchor): AnalyticsAnchor {
  return activeAnchor.month === 1
    ? { month: 12, year: activeAnchor.year - 1 }
    : { month: activeAnchor.month - 1, year: activeAnchor.year };
}

export function getPayPeriodLabel(params: {
  anchor: AnalyticsAnchor;
  dashboardLabel?: string | null;
  payDate: number;
  payFrequency: "monthly" | "every_2_weeks" | "weekly";
}): string {
  if (params.dashboardLabel?.trim()) return params.dashboardLabel.trim();

  const period = buildPayPeriodFromMonthAnchor({
    year: params.anchor.year,
    month: params.anchor.month,
    payDate: params.payDate,
    payFrequency: params.payFrequency,
  });

  return formatPayPeriodLabel(period.start, period.end);
}

export function buildAnalyticsInsightRows(input: AnalyticsDerivedInput): AnalyticsInsightRow[] {
  const monthlyDebt = input.debt?.totalMonthlyDebtPayments ?? 0;
  const monthsWithIncome = input.income?.monthsWithIncome ?? 0;
  const monthsWithSpend = input.expensesByMonth.filter((value) => value > 0).length;
  const activeDebts = input.debt?.activeCount ?? 0;

  if (input.overviewMode === "month") {
    const debtLoadPct = input.currentIncomeTotal > 0 ? Math.min(100, Math.round((monthlyDebt / input.currentIncomeTotal) * 100)) : 0;
    return [
      { label: "Income", value: fmt(input.currentIncomeTotal, input.currency), sub: input.currentPayPeriodLabel },
      { label: "Expenses", value: fmt(input.currentExpenseTotal, input.currency), sub: input.currentPayPeriodLabel },
      { label: "Debt Due", value: fmt(input.currentDebtDue, input.currency), sub: `${activeDebts} active debts` },
      { label: "Debt Load", value: `${debtLoadPct}%`, sub: `${fmt(monthlyDebt, input.currency)} / month` },
    ];
  }

  const debtLoadPct = input.annualIncomeTotal > 0 ? Math.min(100, Math.round((input.annualDebtService / input.annualIncomeTotal) * 100)) : 0;

  return [
    { label: "Income", value: fmt(input.annualIncomeTotal, input.currency), sub: `${monthsWithIncome}/12 months funded` },
    { label: "Expenses", value: fmt(input.annualExpenseTotal, input.currency), sub: `${monthsWithSpend}/12 months with spend` },
    { label: "Debt", value: fmt(input.debt?.totalDebtBalance ?? 0, input.currency), sub: `${activeDebts} active debts` },
    { label: "Debt Load", value: `${debtLoadPct}%`, sub: `${fmt(input.annualDebtService, input.currency)} / year` },
  ];
}

export function buildAnalyticsTopTips(input: AnalyticsDerivedInput): AnalyticsTopTip[] {
  if (input.overviewMode === "year") {
    const highestExpense = input.expensesByMonth.reduce<{ monthIndex: number; total: number }>((best, total, monthIndex) => (
      total > best.total ? { monthIndex, total } : best
    ), { monthIndex: 0, total: 0 });
    const highestIncome = (input.income?.months ?? []).reduce<{ monthIndex: number; total: number }>((best, month) => (
      month.total > best.total ? { monthIndex: month.monthIndex - 1, total: month.total } : best
    ), { monthIndex: 0, total: 0 });
    const monthsWithSpend = input.expensesByMonth.filter((value) => value > 0).length;
    const monthsWithIncome = input.income?.monthsWithIncome ?? 0;
    const debtLoadPct = input.annualIncomeTotal > 0 ? Math.min(100, Math.round((input.annualDebtService / input.annualIncomeTotal) * 100)) : 0;

    return [
      {
        title: "Highest income month",
        detail: `${MONTH_SHORT[highestIncome.monthIndex] ?? "N/A"} brought in ${fmt(highestIncome.total, input.currency)}.`,
        priority: 65,
      },
      {
        title: "Highest expense month",
        detail: `${MONTH_SHORT[highestExpense.monthIndex] ?? "N/A"} used ${fmt(highestExpense.total, input.currency)}.`,
        priority: highestExpense.total > input.annualIncomeTotal / 6 ? 82 : 58,
      },
      {
        title: "Yearly debt load",
        detail: `${debtLoadPct}% of annual income is going to planned debt payments (${fmt(input.annualDebtService, input.currency)}).`,
        priority: debtLoadPct >= 20 ? 84 : 60,
      },
      {
        title: "Coverage this year",
        detail: `${monthsWithIncome}/12 months have income and ${monthsWithSpend}/12 months have recorded spend.`,
        priority: 55,
      },
    ];
  }

  const expenseTips = (input.dashboard?.expenseInsights?.recapTips ?? []).slice(0, 3);
  const debtTips = (input.debt?.tips ?? []).slice(0, 2);
  return [...expenseTips, ...debtTips].slice(0, 4);
}

export function buildAnalyticsChartData(params: {
  currentExpenseTotal: number;
  currentIncomeTotal: number;
  currentPayPeriodLabel: string;
  expensesByMonth: number[];
  income: AnalyticsDerivedInput["income"];
  overviewMode: AnalyticsOverviewMode;
  previousExpenseTotal: number;
  previousIncomeTotal: number;
  previousPayPeriodLabel: string;
}): AnalyticsChartData {
  const incomeYear = Array(12).fill(0);
  (params.income?.months ?? []).forEach((month) => {
    if (month.monthIndex >= 1 && month.monthIndex <= 12) {
      incomeYear[month.monthIndex - 1] = month.total ?? 0;
    }
  });

  if (params.overviewMode === "year") {
    return {
      labels: MONTH_SHORT,
      rawLabels: MONTH_SHORT,
      incomeSeries: incomeYear,
      expenseSeries: params.expensesByMonth,
      maxValue: Math.max(...incomeYear, ...params.expensesByMonth, 1),
    };
  }

  const incomeSeries = [params.previousIncomeTotal, params.currentIncomeTotal];
  const expenseSeries = [params.previousExpenseTotal, params.currentExpenseTotal];

  return {
    labels: ["Previous", "Current"],
    rawLabels: [params.previousPayPeriodLabel, params.currentPayPeriodLabel],
    incomeSeries,
    expenseSeries,
    maxValue: Math.max(...incomeSeries, ...expenseSeries, 1),
  };
}

export function buildDebtDistribution(params: {
  debt: AnalyticsDerivedInput["debt"];
  overviewMode: AnalyticsOverviewMode;
}): AnalyticsDebtDistributionItem[] {
  const getValue = (item: NonNullable<AnalyticsDerivedInput["debt"]>["debts"][number]) => (
    params.overviewMode === "year"
      ? item.currentBalance
      : Math.max(0, Number(item.dueThisMonth ?? item.computedMonthlyPayment ?? 0))
  );

  const topDebts = [...(params.debt?.debts ?? [])]
    .filter((item) => (params.overviewMode === "year"
      ? item.currentBalance > 0
      : Math.max(0, Number(item.dueThisMonth ?? item.computedMonthlyPayment ?? 0)) > 0))
    .sort((a, b) => getValue(b) - getValue(a))
    .slice(0, 5);

  const max = Math.max(...topDebts.map((item) => getValue(item)), 1);

  return topDebts.map((item) => ({
    id: item.id,
    name: item.name,
    value: getValue(item),
    ratio: getValue(item) / max,
  }));
}
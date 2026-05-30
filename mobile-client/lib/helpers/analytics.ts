import { fmt } from "@/lib/formatting";
import type { AppTranslationKey } from "@/lib/i18n";
import { buildPayPeriodFromMonthAnchor, formatPayPeriodLabel, type PayFrequency } from "@/lib/payPeriods";
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
export const OVERVIEW_CHART_H = 148;

export function getAnalyticsMonthLabel(date: Date, locale = "en-GB"): string {
  try {
    return new Intl.DateTimeFormat(locale, { month: "short" }).format(date).replace(/\.$/u, "").toUpperCase();
  } catch {
    return MONTH_SHORT[date.getMonth()] ?? "THIS MONTH";
  }
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
  payFrequency: PayFrequency;
  locale?: string;
}): string {
  if (params.dashboardLabel?.trim()) return params.dashboardLabel.trim();

  const period = buildPayPeriodFromMonthAnchor({
    year: params.anchor.year,
    month: params.anchor.month,
    payDate: params.payDate,
    payFrequency: params.payFrequency,
  });

  return formatPayPeriodLabel(period.start, period.end, params.locale);
}

function getYearModePeriodLabel(params: {
  year: number;
  monthIndex: number;
  payDate: number;
  payFrequency: PayFrequency;
  locale?: string;
}): string {
  const month = params.monthIndex + 1;
  if (!Number.isFinite(month) || month < 1 || month > 12) return "N/A";

  const period = buildPayPeriodFromMonthAnchor({
    year: params.year,
    month,
    payDate: params.payDate,
    payFrequency: params.payFrequency,
  });

  return formatPayPeriodLabel(period.start, period.end, params.locale);
}

export function buildAnalyticsInsightRows(
  input: AnalyticsDerivedInput,
  options: { t: (key: AppTranslationKey, params?: Record<string, string | number>) => string },
): AnalyticsInsightRow[] {
  const monthlyDebt = input.debt?.totalMonthlyDebtPayments ?? 0;
  const monthsWithIncome = input.income?.monthsWithIncome ?? 0;
  const monthsWithSpend = input.expensesByMonth.filter((value) => value > 0).length;
  const activeDebts = input.debt?.activeCount ?? 0;
  const { t } = options;

  if (input.overviewMode === "month") {
    const debtLoadPct = input.currentIncomeTotal > 0 ? Math.min(100, Math.round((monthlyDebt / input.currentIncomeTotal) * 100)) : 0;
    return [
      { variantKey: "income", label: t("analytics.label.income"), value: fmt(input.currentIncomeTotal, input.currency), sub: input.currentPayPeriodLabel },
      { variantKey: "expenses", label: t("analytics.label.expenses"), value: fmt(input.currentExpenseTotal, input.currency), sub: input.currentPayPeriodLabel },
      { variantKey: "debt", label: t("analytics.label.debtDue"), value: fmt(input.currentDebtDue, input.currency), sub: t("analytics.sub.activeDebts", { count: activeDebts }) },
      { variantKey: "debt load", label: t("analytics.label.debtLoad"), value: `${debtLoadPct}%`, sub: t("analytics.sub.perMonth", { amount: fmt(monthlyDebt, input.currency) }) },
    ];
  }

  const debtLoadPct = input.annualIncomeTotal > 0 ? Math.min(100, Math.round((input.annualDebtService / input.annualIncomeTotal) * 100)) : 0;

  return [
    { variantKey: "income", label: t("analytics.label.income"), value: fmt(input.annualIncomeTotal, input.currency), sub: t("analytics.sub.monthsFunded", { count: monthsWithIncome }) },
    { variantKey: "expenses", label: t("analytics.label.expenses"), value: fmt(input.annualExpenseTotal, input.currency), sub: t("analytics.sub.monthsWithSpend", { count: monthsWithSpend }) },
    { variantKey: "debt", label: t("analytics.label.debt"), value: fmt(input.debt?.totalDebtBalance ?? 0, input.currency), sub: t("analytics.sub.activeDebts", { count: activeDebts }) },
    { variantKey: "debt load", label: t("analytics.label.debtLoad"), value: `${debtLoadPct}%`, sub: t("analytics.sub.perYear", { amount: fmt(input.annualDebtService, input.currency) }) },
  ];
}

export function buildAnalyticsTopTips(
  input: AnalyticsDerivedInput,
  options: { locale?: string; t: (key: AppTranslationKey, params?: Record<string, string | number>) => string },
): AnalyticsTopTip[] {
  const { locale, t } = options;
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
        title: t("analytics.tips.highestIncomeMonthTitle"),
        detail: t("analytics.tips.highestIncomeMonthDetail", { period: getYearModePeriodLabel({
          year: input.analyticsYear,
          monthIndex: highestIncome.monthIndex,
          payDate: input.payDate,
          payFrequency: input.payFrequency,
          locale,
        }), amount: fmt(highestIncome.total, input.currency) }),
        priority: 65,
      },
      {
        title: t("analytics.tips.highestExpenseMonthTitle"),
        detail: t("analytics.tips.highestExpenseMonthDetail", { period: getYearModePeriodLabel({
          year: input.analyticsYear,
          monthIndex: highestExpense.monthIndex,
          payDate: input.payDate,
          payFrequency: input.payFrequency,
          locale,
        }), amount: fmt(highestExpense.total, input.currency) }),
        priority: highestExpense.total > input.annualIncomeTotal / 6 ? 82 : 58,
      },
      {
        title: t("analytics.tips.yearlyDebtLoadTitle"),
        detail: t("analytics.tips.yearlyDebtLoadDetail", { percent: debtLoadPct, amount: fmt(input.annualDebtService, input.currency) }),
        priority: debtLoadPct >= 20 ? 84 : 60,
      },
      {
        title: t("analytics.tips.coverageTitle"),
        detail: t("analytics.tips.coverageDetail", { incomeMonths: monthsWithIncome, spendMonths: monthsWithSpend }),
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
  locale?: string;
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
    const labels = Array.from({ length: 12 }, (_, monthIndex) => getAnalyticsMonthLabel(new Date(2000, monthIndex, 1), params.locale));
    return {
      labels,
      rawLabels: labels,
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
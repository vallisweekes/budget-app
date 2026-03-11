import type { DashboardData, DebtSummaryData, InsightTip, IncomeSummaryData } from "@/lib/apiTypes";

export type AnalyticsOverviewMode = "month" | "year";

export type AnalyticsAnchor = {
  month: number;
  year: number;
};

export type AnalyticsInsightRow = {
  label: string;
  value: string;
  sub: string;
};

export type AnalyticsTopTip = InsightTip;

export type AnalyticsChartData = {
  labels: string[];
  rawLabels: string[];
  incomeSeries: number[];
  expenseSeries: number[];
  maxValue: number;
};

export type AnalyticsDebtDistributionItem = {
  id: string;
  name: string;
  value: number;
  ratio: number;
};

export type AnalyticsOverviewLinePoint = {
  value: number;
  label?: string;
  rawLabel?: string;
};

export type AnalyticsScreenControllerState = {
  chartData: AnalyticsChartData;
  chartSpacing: number;
  chartWidth: number;
  currency: string;
  currentMonthLabel: string;
  debtDistribution: AnalyticsDebtDistributionItem[];
  debtDistributionTitle: string;
  error: string | null;
  insightRows: AnalyticsInsightRow[];
  loading: boolean;
  onRefresh: () => void;
  overviewExpenseLine: AnalyticsOverviewLinePoint[];
  overviewIncomeLine: AnalyticsOverviewLinePoint[];
  overviewMaxValue: number;
  overviewMode: AnalyticsOverviewMode;
  overviewWrapWidth: number;
  refreshing: boolean;
  retry: () => void;
  setOverviewWrapWidth: (width: number) => void;
  topHeaderOffset: number;
  topTips: AnalyticsTopTip[];
};

export type AnalyticsDerivedInput = {
  annualDebtService: number;
  annualExpenseTotal: number;
  annualIncomeTotal: number;
  currency: string;
  currentDebtDue: number;
  currentExpenseTotal: number;
  currentIncomeTotal: number;
  currentPayPeriodLabel: string;
  dashboard: DashboardData | null;
  debt: DebtSummaryData | null;
  expensesByMonth: number[];
  income: IncomeSummaryData | null;
  overviewMode: AnalyticsOverviewMode;
};
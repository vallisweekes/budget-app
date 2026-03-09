import type { DebtSummaryItem } from "@/lib/apiTypes";
import type { DebtAnalyticsColorSlice, DebtAnalyticsGanttItem, DebtAnalyticsStat } from "@/types/DebtAnalyticsScreen.types";

export type DebtAnalyticsInsightsProps = {
  earliest?: DebtAnalyticsStat;
  highestAPR?: DebtSummaryItem;
  latest?: DebtAnalyticsStat;
};

export type DebtAnalyticsProgressListProps = {
  currency: string;
  items: DebtAnalyticsStat[];
};

export type DebtAnalyticsDonutChartProps = {
  colors: string[];
  currency: string;
  debts: DebtSummaryItem[];
};

export type DebtAnalyticsTimelineChartProps = {
  items: DebtAnalyticsGanttItem[];
  maxMonths: number;
};

export type DebtAnalyticsSummaryStripProps = {
  currency: string;
  paidTotal: number;
  total: number;
  totalMonthly: number;
};

export type { DebtAnalyticsColorSlice };
import type { AnalyticsChartData, AnalyticsOverviewLinePoint, AnalyticsOverviewMode } from "@/types/AnalyticsScreen.types";

export type AnalyticsOverviewPointerItem = {
  value: number;
  index?: number;
  label?: string;
  rawLabel?: string;
};

export type AnalyticsOverviewCardProps = {
  chartData: AnalyticsChartData;
  chartSpacing: number;
  chartWidth: number;
  currency: string;
  currentMonthLabel: string;
  expenseLine: AnalyticsOverviewLinePoint[];
  incomeLine: AnalyticsOverviewLinePoint[];
  onWrapWidthChange: (width: number) => void;
  overviewMaxValue: number;
  overviewMode: AnalyticsOverviewMode;
  overviewWrapWidth: number;
};
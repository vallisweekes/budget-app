import type { AnalyticsDebtDistributionItem, AnalyticsOverviewMode } from "@/types/AnalyticsScreen.types";

export type AnalyticsDebtDistributionCardProps = {
  currency: string;
  items: AnalyticsDebtDistributionItem[];
  overviewMode: AnalyticsOverviewMode;
  title: string;
};
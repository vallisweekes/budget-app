import type { DebtSummaryItem } from "@/lib/apiTypes";

export type DebtAnalyticsColorSlice = {
  len: number;
  offset: number;
  rawLen: number;
  color: string;
};

export type DebtAnalyticsStat = {
  debt: DebtSummaryItem;
  months: number;
  color: string;
  pctPaid: number;
};

export type DebtAnalyticsGanttItem = {
  debt: DebtSummaryItem;
  months: number;
  color: string;
};

export type DebtAnalyticsControllerState = {
  activeDebts: DebtSummaryItem[];
  colors: string[];
  currency: string;
  debtStats: DebtAnalyticsStat[];
  error: string | null;
  ganttItems: DebtAnalyticsGanttItem[];
  highestAPR: DebtSummaryItem | undefined;
  latest: DebtAnalyticsStat | undefined;
  loading: boolean;
  load: () => Promise<void>;
  maxMonths: number;
  paidTotal: number;
  topContentInset: number;
  total: number;
  totalMonthly: number;
  earliest: DebtAnalyticsStat | undefined;
};

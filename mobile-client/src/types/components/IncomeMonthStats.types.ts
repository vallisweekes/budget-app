import type { IncomeMonthData } from "@/lib/apiTypes";

export interface IncomeMonthStatsProps {
  data: IncomeMonthData;
  currency: string;
  fmt: (v: number, c: string) => string;
}

import type { IncomeMonthData } from "@/lib/apiTypes";

export interface BillsSummaryProps {
  data: IncomeMonthData;
  currency: string;
  fmt: (v: number, c: string) => string;
}

import type { IncomeSummaryMonth } from "@/lib/apiTypes";

export interface IncomeMonthCardProps {
  item: IncomeSummaryMonth;
  currency: string;
  fmt: (v: number, c: string) => string;
  onPress: () => void;
  active?: boolean;
  locked?: boolean;
}

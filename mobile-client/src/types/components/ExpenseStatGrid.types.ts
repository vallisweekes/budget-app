export interface ExpenseStatGridProps {
  totalAmount: number;
  totalCount: number;
  paidAmount: number;
  paidCount: number;
  unpaidAmount: number;
  unpaidCount: number;
  currency: string;
  fmt: (v: number, c: string) => string;
}

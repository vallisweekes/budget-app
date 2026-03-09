import type { UpcomingPayment } from "@/lib/apiTypes";

export interface UpcomingListProps {
  payments: UpcomingPayment[];
  currency: string;
  fmt: (v: number, c: string) => string;
}

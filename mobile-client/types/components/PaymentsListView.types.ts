import type { DebtRow, ExpenseRow } from "@/hooks";

import type { PaymentDetailSheetItem } from "./PaymentDetailSheet.types";

export type PaymentsListSection = {
  title: string;
  data: Array<ExpenseRow | DebtRow>;
};

export type PaymentsListViewRenderRowArgs = {
  item: ExpenseRow | DebtRow;
  section: { title: string };
};

export type PaymentsListViewProps = {
  query: string;
  onQueryChange: (value: string) => void;
  showSearch?: boolean;
  sections: PaymentsListSection[];
  fallbackNotice?: string | null;
  refreshing: boolean;
  onRefresh: () => void;
  currency: string;
  showEmpty: boolean;
  onOpenItem: (item: PaymentDetailSheetItem) => void;
};
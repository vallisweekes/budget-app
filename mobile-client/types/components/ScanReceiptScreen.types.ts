import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import type { ExpensesStackParamList } from "@/navigation/types";

export type ScanReceiptScreenProps = NativeStackScreenProps<ExpensesStackParamList, "ScanReceipt">;

export type ScanReceiptStage = "pick" | "scanning" | "confirm" | "saving";

export type ScanReceiptFundingSource = "income" | "savings" | "monthly_allowance" | "credit_card" | "loan" | "other";

export type ScanReceiptFundingOption = {
  value: ScanReceiptFundingSource;
  label: string;
};

export type ScanReceiptPaymentSource = "income" | "savings" | "credit_card" | "extra_untracked";

export type ScanReceiptDateFields = {
  month: number;
  year: number;
};
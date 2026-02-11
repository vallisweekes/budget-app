import SpendingTab from "./SpendingTab";
import type { MonthKey } from "@/types";

type Debt = {
  id: string;
  name: string;
  type: "credit_card" | "loan" | "high_purchase";
};

type SpendingEntry = {
  id: string;
  description: string;
  amount: number;
  date: string;
  month: string;
  source: "card" | "savings" | "allowance";
  sourceId?: string;
};

type ViewTabsProps = {
	month: MonthKey;
  debts: Debt[];
  spending: SpendingEntry[];
  categoryData?: unknown;
  regularExpenses?: unknown;
  totalIncome?: number;
  totalExpenses?: number;
  remaining?: number;
  totalDebtBalance?: number;
  goals?: unknown;
};

export default function ViewTabs({
  month,
  debts,
  spending,
}: ViewTabsProps) {
  // For now, just show the SpendingTab and a placeholder for other tabs
  // Later, add tab switching logic
  return (
    <div>
      <div className="mb-6">
        {/* TODO: Add tab navigation here */}
			<SpendingTab month={month} debts={debts} spending={spending} />
      </div>
      {/* TODO: Render other dashboard content here, conditionally by tab */}
    </div>
  );
}

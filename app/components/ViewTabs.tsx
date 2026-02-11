import SpendingTab from "./SpendingTab";
import type { MonthKey } from "../../lib/budget/engine";

type ViewTabsProps = {
	month: MonthKey;
	categoryData: unknown;
	regularExpenses: unknown;
	totalIncome: number;
	totalExpenses: number;
	remaining: number;
	debts: unknown;
	totalDebtBalance: number;
	goals: unknown;
};

export default function ViewTabs({
  month,
  categoryData,
  regularExpenses,
  totalIncome,
  totalExpenses,
  remaining,
  debts,
  totalDebtBalance,
  goals,
}: ViewTabsProps) {
  // For now, just show the SpendingTab and a placeholder for other tabs
  // Later, add tab switching logic
  return (
    <div>
      <div className="mb-6">
        {/* TODO: Add tab navigation here */}
        <SpendingTab month={month} debts={debts} />
      </div>
      {/* TODO: Render other dashboard content here, conditionally by tab */}
    </div>
  );
}

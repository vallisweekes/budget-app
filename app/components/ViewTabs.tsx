import dynamic from "next/dynamic";
import SpendingTab from "./SpendingTab";

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
}) {
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

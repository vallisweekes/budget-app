import type React from "react";

import type { Income, IncomeMonthData } from "@/lib/apiTypes";

export type IncomeMonthIncomeListCrudLike = {
  showAddForm: boolean;
  setShowAddForm: React.Dispatch<React.SetStateAction<boolean>>;
  newName: string;
  newAmount: string;
  setNewName: (value: string) => void;
  setNewAmount: (value: string) => void;
  distributeMonths: boolean;
  setDistributeMonths: (value: boolean) => void;
  distributeYears: boolean;
  setDistributeYears: (value: boolean) => void;
  handleAdd: () => Promise<void>;
  saving: boolean;
  startEdit: (item: Income) => void;
};

export type IncomeMonthIncomeListProps = {
  items: Income[];
  analysis: IncomeMonthData | null;
  currency: string;
  isLocked: boolean;
  refreshing: boolean;
  onRefresh: () => void;
  crud: IncomeMonthIncomeListCrudLike;
};
import type { Income } from "@/lib/apiTypes";

export interface IncomeRowProps {
  item: Income;
  currency: string;
  onPress?: () => void;
}

export interface IncomeEditRowProps {
  editName: string;
  editAmount: string;
  setEditName: (v: string) => void;
  setEditAmount: (v: string) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
}

import type { BudgetPlanListItem } from "@/lib/apiTypes";

export type SettingsPlansTabProps = {
  plans: BudgetPlanListItem[];
  currentPlanId: string | null;
  switchingPlanId: string | null;
  deletingPlanId: string | null;
  onSwitchPlan: (planId: string) => void;
  onDeletePlan: (plan: BudgetPlanListItem) => void;
  onCreateHoliday: () => void;
  onCreateCarnival: () => void;
};

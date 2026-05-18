import type { RouteProp } from "@react-navigation/native";

import type { RootStackParamList } from "@/navigation/types";

export type GoalDetailRoute = RouteProp<RootStackParamList, "GoalDetail">;

export type GoalDetailHeroProps = {
  title: string;
  currentAmount: number;
  targetAmount: number;
  currency?: string | null;
  progress: number;
};

export type GoalDetailFormProps = {
  title: string;
  description: string;
  targetAmount: string;
  targetYear: string;
  currentAmountDraft: string;
  currentAmount: number;
  currentAmountEditable: boolean;
  currentAmountHint: string;
  currentAmountLabel: string;
  currency?: string | null;
  disabled: boolean;
  onCurrentAmountChange: (value: string) => void;
  onTitleChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onTargetAmountChange: (value: string) => void;
  onTargetYearChange: (value: string) => void;
};

export type GoalDetailHomeToggleProps = {
  showOnHome: boolean;
  disabled: boolean;
  onPress: () => void;
};

export type GoalDetailFooterProps = {
  isDirty: boolean;
  saving: boolean;
  deleting: boolean;
  onDelete: () => void;
  onSave: () => void;
};
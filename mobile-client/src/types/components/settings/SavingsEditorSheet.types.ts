import type React from "react";
import type { Animated } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import type { SavingsField, SavingsSheetMode } from "@/types/settings";

export type SavingsEditorSheetProps = {
  visible: boolean;
  mode: SavingsSheetMode;
  field: SavingsField | null;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  title: string;
  currency?: string | null;
  currentAmount: number;
  valueDraft: string;
  potNameDraft: string;
  goalImpactNote: string | null;
  saveBusy: boolean;
  insetsBottom: number;
  translateY: Animated.Value;
  panHandlers: Record<string, unknown>;
  formatMoneyText: (value: number) => string;
  parseMoneyNumber: (value: string | number | null | undefined) => number;
  onClose: () => void;
  onChangeValue: (next: string) => void;
  onChangePotName: (next: string) => void;
  onDelete: () => void;
  onSave: () => void;
};
import type { Animated } from "react-native";

import type { PlanKind } from "@/types/settings";

export type SettingsCreatePlanSheetProps = {
  visible: boolean;
  keyboardOffset: number;
  translateY: Animated.Value;
  panHandlers: Record<string, unknown>;
  newPlanType: PlanKind;
  newPlanName: string;
  newPlanEventDate: string;
  showPlanEventDatePicker: boolean;
  saveBusy: boolean;
  onClose: () => void;
  onChangePlanType: (value: PlanKind) => void;
  onChangePlanName: (value: string) => void;
  onOpenDatePicker: () => void;
  onCloseDatePicker: () => void;
  onAndroidDateChange: (nextDate: string) => void;
  onCreate: () => void;
};

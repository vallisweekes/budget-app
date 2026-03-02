import type { Animated } from "react-native";

export type SettingsDebtSheetProps = {
  visible: boolean;
  title: string;
  actionLabel: string;
  currency?: string | null;
  insetsBottom: number;
  keyboardOffset: number;
  translateY: Animated.Value;
  panHandlers: Record<string, unknown>;
  name: string;
  balance: string;
  interestRate: string;
  creditLimit: string;
  saveBusy: boolean;
  onClose: () => void;
  onChangeName: (value: string) => void;
  onChangeBalance: (value: string) => void;
  onChangeInterestRate: (value: string) => void;
  onChangeCreditLimit: (value: string) => void;
  onSubmit: () => void;
};
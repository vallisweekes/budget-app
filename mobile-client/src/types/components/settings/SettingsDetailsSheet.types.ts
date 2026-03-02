import type { Animated } from "react-native";

export type SettingsDetailsSheetProps = {
  visible: boolean;
  translateY: Animated.Value;
  panHandlers: Record<string, unknown>;
  username: string;
  emailDraft: string;
  saveBusy: boolean;
  onClose: () => void;
  onChangeEmail: (value: string) => void;
  onSave: () => void;
};

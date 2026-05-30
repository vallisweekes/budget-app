import type { Animated } from "react-native";

export type SettingsLocaleSheetProps = {
  visible: boolean;
  keyboardOffset: number;
  translateY: Animated.Value;
  panHandlers: Record<string, unknown>;
  countryDraft: string;
  languageDraft: string;
  detectedCountry: string | null;
  saveBusy: boolean;
  onClose: () => void;
  onChangeCountry: (value: string) => void;
  onChangeLanguage: (value: string) => void;
  onSave: () => void;
};

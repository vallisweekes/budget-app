import type { StyleProp, ViewStyle } from "react-native";

export type OverlaySelectInputOption = {
  value: string;
  label: string;
  activeColor?: string;
};

export type OverlaySelectInputProps = {
  value: string;
  options: OverlaySelectInputOption[];
  onChange: (next: string) => void;
  placeholder?: string;
  containerStyle?: StyleProp<ViewStyle>;
  triggerStyle?: StyleProp<ViewStyle>;
};
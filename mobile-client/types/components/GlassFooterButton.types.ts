import type { StyleProp, TextStyle, ViewStyle } from "react-native";

export type GlassFooterButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: "dark" | "light";
  tone?: "light" | "dark" | "danger";
  containerStyle?: StyleProp<ViewStyle>;
  glassStyle?: StyleProp<ViewStyle>;
  labelStyle?: StyleProp<TextStyle>;
  loadingColor?: string;
};
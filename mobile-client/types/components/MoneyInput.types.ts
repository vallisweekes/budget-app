import type { StyleProp, TextInputProps, TextStyle, ViewStyle } from "react-native";

export type MoneyInputProps = {
  currency?: string | null;
  value: string;
  onChangeValue: (next: string) => void;
  variant?: "default" | "light";
  placeholder?: string;
  keyboardType?: TextInputProps["keyboardType"];
  containerStyle?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
} & Omit<TextInputProps, "value" | "onChangeText" | "placeholder" | "keyboardType">;
import type { StyleProp, TextStyle, ViewStyle } from "react-native";

export type DatePickerInputProps = {
  value?: string;
  placeholder?: string;
  onPress: () => void;
  disabled?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
  valueStyle?: StyleProp<TextStyle>;
  placeholderStyle?: StyleProp<TextStyle>;
  iconColor?: string;
  iconSize?: number;
};
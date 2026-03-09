import type { StyleProp, TextStyle, ViewStyle } from "react-native";

export type NoteBadgeProps = {
  text: string;
  containerStyle?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  accentStyle?: StyleProp<ViewStyle>;
};
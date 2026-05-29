import type { StyleProp, TextInputProps, TextStyle } from "react-native";

export type UnderlineTextInputProps = TextInputProps & {
  style?: StyleProp<TextStyle>;
  disabledStyle?: StyleProp<TextStyle>;
};

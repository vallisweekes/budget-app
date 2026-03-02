import React from "react";
import { Text, View, type StyleProp, type TextStyle, type ViewStyle } from "react-native";

import { styles } from "./styles";

type Props = {
  text: string;
  containerStyle?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  accentStyle?: StyleProp<ViewStyle>;
};

export default function NoteBadge({ text, containerStyle, textStyle, accentStyle }: Props) {
  return (
    <View style={[styles.badge, containerStyle]}>
      <View style={[styles.accent, accentStyle]} />
      <Text style={[styles.text, textStyle]}>{text}</Text>
    </View>
  );
}

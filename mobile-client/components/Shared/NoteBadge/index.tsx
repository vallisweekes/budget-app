import React from "react";
import { Text, View } from "react-native";

import type { NoteBadgeProps } from "@/types";
import { styles } from "./styles";

export default function NoteBadge({ text, containerStyle, textStyle, accentStyle }: NoteBadgeProps) {
  return (
    <View style={[styles.badge, containerStyle]}>
      <View style={[styles.accent, accentStyle]} />
      <Text style={[styles.text, textStyle]}>{text}</Text>
    </View>
  );
}

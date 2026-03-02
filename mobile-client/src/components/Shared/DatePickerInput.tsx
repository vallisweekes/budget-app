import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { T } from "@/lib/theme";

type Props = {
  value?: string;
  placeholder?: string;
  onPress: () => void;
  disabled?: boolean;
  containerStyle?: any;
  valueStyle?: any;
  placeholderStyle?: any;
  iconColor?: string;
  iconSize?: number;
};

export default function DatePickerInput({
  value,
  placeholder = "Select date",
  onPress,
  disabled,
  containerStyle,
  valueStyle,
  placeholderStyle,
  iconColor = T.accent,
  iconSize = 18,
}: Props) {
  const hasValue = Boolean(String(value ?? "").trim());

  return (
    <Pressable style={containerStyle} onPress={onPress} disabled={disabled}>
      <View style={s.row}>
        <Text style={[s.value, valueStyle, !hasValue && s.placeholder, !hasValue && placeholderStyle]} numberOfLines={1}>
          {hasValue ? value : placeholder}
        </Text>
        <Ionicons name="calendar-outline" size={iconSize} color={iconColor} />
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  value: {
    color: T.text,
    fontSize: 15,
    fontWeight: "700",
    flex: 1,
    paddingRight: 8,
  },
  placeholder: {
    color: T.textMuted,
  },
});

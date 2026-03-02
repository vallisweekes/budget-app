import React from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { styles } from "./styles";

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
      <View style={styles.row}>
        <Text style={[styles.value, valueStyle, !hasValue && styles.placeholder, !hasValue && placeholderStyle]} numberOfLines={1}>
          {hasValue ? value : placeholder}
        </Text>
        <Ionicons name="calendar-outline" size={iconSize} color={iconColor} />
      </View>
    </Pressable>
  );
}

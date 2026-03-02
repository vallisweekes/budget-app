import React from "react";
import { View, Text, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { T } from "@/lib/theme";
import type { MonthBarProps } from "@/types";
import { styles } from "./styles";

const MONTH_NAMES = [
  "Jan","Feb","Mar","Apr","May","Jun",
  "Jul","Aug","Sep","Oct","Nov","Dec",
];

export default function MonthBar({
  month,
  year,
  onPrev,
  onNext,
  prevDisabled = false,
}: MonthBarProps) {
  return (
    <View style={styles.bar}>
      <Text style={styles.label}>
        {MONTH_NAMES[month - 1]} {year}
      </Text>

      <View style={styles.actions}>
        <Pressable
          onPress={onPrev}
          disabled={prevDisabled}
          style={[styles.arrow, prevDisabled && styles.arrowDisabled]}
          hitSlop={8}
        >
          <Ionicons
            name="chevron-back"
            size={20}
            color={prevDisabled ? T.textMuted : T.text}
          />
        </Pressable>
        <Pressable onPress={onNext} style={styles.arrow} hitSlop={8}>
          <Ionicons name="chevron-forward" size={20} color={T.text} />
        </Pressable>
      </View>
    </View>
  );
}

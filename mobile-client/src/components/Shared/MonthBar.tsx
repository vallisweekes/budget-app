import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface MonthBarProps {
  month: number;
  year: number;
  onPrev: () => void;
  onNext: () => void;
  /** Disable the back arrow when at the earliest allowed month */
  prevDisabled?: boolean;
}

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
    <View style={s.bar}>
      <Pressable
        onPress={onPrev}
        disabled={prevDisabled}
        style={[s.arrow, prevDisabled && s.arrowDisabled]}
        hitSlop={8}
      >
        <Ionicons
          name="chevron-back"
          size={20}
          color={prevDisabled ? "rgba(2,239,240,0.3)" : "#02eff0"}
        />
      </Pressable>
      <Text style={s.label}>
        {MONTH_NAMES[month - 1]} {year}
      </Text>
      <Pressable onPress={onNext} style={s.arrow} hitSlop={8}>
        <Ionicons name="chevron-forward" size={20} color="#02eff0" />
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  arrow: { padding: 8 },
  arrowDisabled: { opacity: 0.4 },
  label: { color: "#fff", fontSize: 16, fontWeight: "700" },
});

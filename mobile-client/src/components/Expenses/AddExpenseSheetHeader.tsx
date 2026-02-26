import React from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { T } from "@/lib/theme";
import { s } from "@/components/Expenses/AddExpenseSheet.styles";

export default function AddExpenseSheetHeader({
  month,
  year,
  canPrev = true,
  onPrevMonth,
  onNextMonth,
  onClose,
}: {
  month: number;
  year: number;
  canPrev?: boolean;
  onPrevMonth?: () => void;
  onNextMonth?: () => void;
  onClose: () => void;
}) {
  const label = new Date(year, month - 1).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
  });

  return (
    <View style={s.header}>
      <View style={{ flex: 1 }}>
        <Text style={s.title}>Add Expense</Text>
        <View style={{ flexDirection: "row", alignItems: "center", marginTop: 4, gap: 4 }}>
          <Pressable
            onPress={onPrevMonth}
            hitSlop={10}
            disabled={!canPrev}
            style={{ opacity: canPrev ? 1 : 0.25 }}
          >
            <Ionicons name="chevron-back" size={16} color={T.text} />
          </Pressable>
          <Text style={{ color: T.text, fontSize: 13, fontWeight: "600" }}>
            {label}
          </Text>
          <Pressable onPress={onNextMonth} hitSlop={10}>
            <Ionicons name="chevron-forward" size={16} color={T.text} />
          </Pressable>
        </View>
      </View>
      <Pressable onPress={onClose} style={s.closeBtn} hitSlop={8}>
        <Ionicons name="close" size={20} color={T.textDim} />
      </Pressable>
    </View>
  );
}

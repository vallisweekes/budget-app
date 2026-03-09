import React from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { MONTH_NAMES_SHORT } from "@/lib/constants";
import { T } from "@/lib/theme";
import { styles as s } from "@/components/Expenses/AddExpenseSheet/styles";

export default function AddExpenseSheetHeader({
  month,
  year,
  title = "Add Expense",
  canPrev = true,
  onPrevMonth,
  onNextMonth,
  onClose,
}: {
  month: number;
  year: number;
  title?: string;
  canPrev?: boolean;
  onPrevMonth?: () => void;
  onNextMonth?: () => void;
  onClose: () => void;
}) {
  const safeMonth = Math.max(1, Math.min(12, month));
  const start = MONTH_NAMES_SHORT[(safeMonth + 10) % 12];
  const end = MONTH_NAMES_SHORT[(safeMonth + 11) % 12];
  const label = `${start} - ${end}`;

  return (
    <View style={s.header}>
      <View style={{ flex: 1 }}>
        <Text style={s.title}>{title}</Text>
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

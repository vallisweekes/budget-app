import React from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { T } from "@/lib/theme";
import { s } from "@/components/Expenses/AddExpenseSheet.styles";

export default function AddExpenseSheetHeader({
  month,
  year,
  onClose,
}: {
  month: number;
  year: number;
  onClose: () => void;
}) {
  return (
    <View style={s.header}>
      <View>
        <Text style={s.title}>Add Expense</Text>
        <Text style={s.sub}>
          {new Date(year, month - 1).toLocaleDateString("en-GB", {
            month: "long",
            year: "numeric",
          })}
        </Text>
      </View>
      <Pressable onPress={onClose} style={s.closeBtn} hitSlop={8}>
        <Ionicons name="close" size={20} color={T.textDim} />
      </Pressable>
    </View>
  );
}

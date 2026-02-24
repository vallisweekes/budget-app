import React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import type { ExpenseCategoryBreakdown } from "@/lib/apiTypes";
import { resolveCategoryColor } from "@/lib/categoryColors";

import { pr } from "@/components/Expenses/AddExpenseSheet.styles";

export default function AddExpenseCategoryRow({
  categories,
  value,
  onChange,
}: {
  categories: ExpenseCategoryBreakdown[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={pr.row}
      keyboardShouldPersistTaps="handled"
    >
      <Pressable style={[pr.pill, value === "" && pr.pillSelected]} onPress={() => onChange("")}>
        <Text style={[pr.pillTxt, value === "" && pr.pillTxtSelected]}>None</Text>
      </Pressable>

      {categories.map((c) => {
        const active = value === c.categoryId;
        const color = resolveCategoryColor(c.color);
        return (
          <Pressable
            key={c.categoryId}
            style={[pr.pill, active && { borderColor: color, backgroundColor: `${color}22` }]}
            onPress={() => onChange(c.categoryId)}
          >
            <View style={[pr.dot, { backgroundColor: color }]} />
            <Text style={[pr.pillTxt, active && { color: color, fontWeight: "900" }]} numberOfLines={1}>
              {c.name}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

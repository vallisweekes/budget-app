import React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import type { ExpenseCategoryBreakdown } from "@/lib/apiTypes";
import { resolveCategoryColor } from "@/lib/categoryColors";

import { pr } from "@/components/Expenses/AddExpenseSheet/styles";

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
      {categories.map((c) => {
        const active = value === c.categoryId;
        const color = resolveCategoryColor(c.color);
        return (
          <Pressable
            key={c.categoryId}
            style={[
              pr.pill,
              active && pr.pillSelected,
              active && {
                borderColor: color,
                backgroundColor: `${color}20`,
                shadowColor: color,
                shadowOpacity: 0.2,
                shadowRadius: 12,
                shadowOffset: { width: 0, height: 6 },
                elevation: 4,
              },
            ]}
            onPress={() => onChange(c.categoryId)}
          >
            <View style={[pr.dot, { backgroundColor: color }]} />
            <Text style={[pr.pillTxt, active && pr.pillTxtSelected, active && { color }]} numberOfLines={1}>
              {c.name}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

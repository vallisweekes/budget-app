import React from "react";
import { ScrollView, Text, TextInput, View } from "react-native";

import type { ExpenseCategoryBreakdown } from "@/lib/apiTypes";
import { T } from "@/lib/theme";

import AddExpenseCategoryRow from "@/components/Expenses/AddExpenseCategoryRow";
import { s } from "@/components/Expenses/AddExpenseSheet.styles";

export default function AddExpenseSheetFields({
  name,
  setName,
  amount,
  setAmount,
  categoryId,
  setCategoryId,
  dueDate,
  setDueDate,
  categories,
  currency,
}: {
  name: string;
  setName: (v: string) => void;
  amount: string;
  setAmount: (v: string) => void;
  categoryId: string;
  setCategoryId: (v: string) => void;
  dueDate: string;
  setDueDate: (v: string) => void;
  categories: ExpenseCategoryBreakdown[];
  currency: string;
}) {
  return (
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.formScroll} showsVerticalScrollIndicator={false}>
      <View style={s.fieldGroup}>
        <Text style={s.label}>Expense name</Text>
        <TextInput
          style={s.input}
          value={name}
          onChangeText={setName}
          placeholder="e.g. Netflix, Rent…"
          placeholderTextColor={T.textMuted}
          selectionColor={T.accent}
          returnKeyType="next"
          autoCapitalize="words"
        />
      </View>

      <View style={s.fieldGroup}>
        <Text style={s.label}>Amount ({currency})</Text>
        <TextInput
          style={s.input}
          value={amount}
          onChangeText={setAmount}
          placeholder="0.00"
          placeholderTextColor={T.textMuted}
          selectionColor={T.accent}
          keyboardType="decimal-pad"
          returnKeyType="done"
        />
      </View>

      <View style={s.fieldGroup}>
        <Text style={s.label}>Category</Text>
        <AddExpenseCategoryRow categories={categories} value={categoryId} onChange={setCategoryId} />
      </View>

      <View style={s.fieldGroup}>
        <Text style={s.label}>
          Due date <Text style={s.optional}>(optional)</Text>
        </Text>
        <TextInput
          style={s.input}
          value={dueDate}
          onChangeText={setDueDate}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={T.textMuted}
          selectionColor={T.accent}
          keyboardType="numbers-and-punctuation"
          returnKeyType="done"
        />
      </View>
    </ScrollView>
  );
}

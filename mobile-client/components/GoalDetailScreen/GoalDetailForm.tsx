import React from "react";
import { Text, TextInput, View } from "react-native";

import { fmt } from "@/lib/formatting";
import { T } from "@/lib/theme";
import MoneyInput from "@/components/Shared/MoneyInput";

import { styles } from "./style";

type GoalDetailFormProps = {
  title: string;
  description: string;
  targetAmount: string;
  targetYear: string;
  currentAmount: number;
  currency?: string | null;
  disabled: boolean;
  onTitleChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onTargetAmountChange: (value: string) => void;
  onTargetYearChange: (value: string) => void;
};

export default function GoalDetailForm(props: GoalDetailFormProps) {
  const {
    title,
    description,
    targetAmount,
    targetYear,
    currentAmount,
    currency,
    disabled,
    onTitleChange,
    onDescriptionChange,
    onTargetAmountChange,
    onTargetYearChange,
  } = props;

  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>Goal details</Text>

      <Text style={styles.inputLabel}>Goal name</Text>
      <TextInput
        value={title}
        onChangeText={onTitleChange}
        placeholder="Goal name"
        placeholderTextColor={T.textMuted}
        style={styles.input}
        editable={!disabled}
      />

      <Text style={styles.inputLabel}>Description</Text>
      <TextInput
        value={description}
        onChangeText={onDescriptionChange}
        placeholder="Optional notes"
        placeholderTextColor={T.textMuted}
        style={[styles.input, styles.inputMultiline]}
        editable={!disabled}
        multiline
        textAlignVertical="top"
      />

      <View style={styles.row2}>
        <View style={styles.rowItem}>
          <Text style={styles.inputLabel}>Target amount</Text>
          <MoneyInput
            currency={currency}
            value={targetAmount}
            onChangeValue={onTargetAmountChange}
            placeholder="e.g. 10000"
            editable={!disabled}
          />
        </View>
        <View style={styles.rowItem}>
          <Text style={styles.inputLabel}>Current progress</Text>
          <View style={styles.readOnlyValueCard}>
            <Text style={styles.readOnlyValueText}>{fmt(currentAmount, currency ?? undefined)}</Text>
            <Text style={styles.readOnlyValueHint}>Linked to settings balances and monthly allocations</Text>
          </View>
        </View>
      </View>

      <Text style={styles.inputLabel}>Target year</Text>
      <TextInput
        value={targetYear}
        onChangeText={onTargetYearChange}
        placeholder="e.g. 2030"
        placeholderTextColor={T.textMuted}
        style={styles.input}
        keyboardType="number-pad"
        editable={!disabled}
      />
    </View>
  );
}
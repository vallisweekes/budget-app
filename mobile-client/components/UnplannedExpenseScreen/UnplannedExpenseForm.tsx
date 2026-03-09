import React from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import type { UnplannedExpenseFormProps } from "@/types";
import { fmt } from "@/lib/formatting";
import { T } from "@/lib/theme";
import MoneyInput from "@/components/Shared/MoneyInput";

import { MONTH_NAMES } from "@/lib/hooks/useUnplannedExpenseScreenController";

import ScanReceiptShortcut from "./ScanReceiptShortcut";
import { styles } from "./style";

export default function UnplannedExpenseForm({
  amount,
  canSubmit,
  categoryId,
  currency,
  fundingLabel,
  fundingSource,
  loadingData,
  month,
  name,
  needsDebtChoice,
  newLoanName,
  parsedAmount,
  selectedCategory,
  selectedDebt,
  submitError,
  submitting,
  usingNewLoan,
  year,
  onAmountChange,
  onCategoryPress,
  onDebtPress,
  onDescriptionChange,
  onFundingPress,
  onMonthPress,
  onNewLoanNameChange,
  onScanReceiptPress,
  onSubmit,
}: UnplannedExpenseFormProps) {
  if (loadingData) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={T.accent} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
      <ScanReceiptShortcut onPress={onScanReceiptPress} />

      <View style={styles.amountCard}>
        <View style={styles.amountLabelRow}>
          <Ionicons name="flash" size={15} color={T.accent} />
          <Text style={styles.amountLabel}>How much did you spend?</Text>
        </View>
        <MoneyInput currency={currency} value={amount} onChangeValue={onAmountChange} placeholder="0.00" returnKeyType="done" />
      </View>

      <View style={styles.fieldCard}>
        <Text style={styles.fieldLabel}>Description</Text>
        <TextInput
          style={styles.fieldInput}
          value={name}
          onChangeText={onDescriptionChange}
          placeholder="e.g. Lunch, taxi, groceries…"
          placeholderTextColor={T.textMuted}
          returnKeyType="done"
          maxLength={80}
        />
      </View>

      <Pressable style={styles.fieldCard} onPress={onCategoryPress}>
        <Text style={styles.fieldLabel}>Category</Text>
        <View style={styles.fieldRow}>
          {selectedCategory ? (
            <>
              <View style={[styles.catDot, { backgroundColor: selectedCategory.color ?? T.accentDim }]} />
              <Text style={styles.fieldValue}>{selectedCategory.name}</Text>
            </>
          ) : (
            <Text style={styles.fieldPlaceholder}>Select a category</Text>
          )}
          <Ionicons name="chevron-forward" size={16} color={T.textDim} style={styles.fieldChevron} />
        </View>
      </Pressable>

      <Pressable style={styles.fieldCard} onPress={onFundingPress}>
        <Text style={styles.fieldLabel}>Funds From</Text>
        <View style={styles.fieldRow}>
          <Text style={styles.fieldValue}>{fundingLabel}</Text>
          <Ionicons name="chevron-forward" size={16} color={T.textDim} style={styles.fieldChevron} />
        </View>
      </Pressable>

      {needsDebtChoice ? (
        <Pressable style={styles.fieldCard} onPress={onDebtPress}>
          <Text style={styles.fieldLabel}>{fundingSource === "credit_card" ? "Credit Card" : "Loan"}</Text>
          <View style={styles.fieldRow}>
            {selectedDebt ? (
              <Text style={styles.fieldValue}>{selectedDebt.name}</Text>
            ) : usingNewLoan ? (
              <Text style={styles.fieldValue}>Create new loan</Text>
            ) : (
              <Text style={styles.fieldPlaceholder}>
                {fundingSource === "credit_card" ? "Select a card" : "Select existing or create new loan"}
              </Text>
            )}
            <Ionicons name="chevron-forward" size={16} color={T.textDim} style={styles.fieldChevron} />
          </View>
        </Pressable>
      ) : null}

      {usingNewLoan ? (
        <View style={styles.fieldCard}>
          <Text style={styles.fieldLabel}>New Loan Name</Text>
          <TextInput
            style={styles.fieldInput}
            value={newLoanName}
            onChangeText={onNewLoanNameChange}
            placeholder="e.g. Family loan"
            placeholderTextColor={T.textMuted}
            returnKeyType="done"
            maxLength={80}
          />
        </View>
      ) : null}

      <Pressable style={styles.fieldCard} onPress={onMonthPress}>
        <Text style={styles.fieldLabel}>Month</Text>
        <View style={styles.fieldRow}>
          <Text style={styles.fieldValue}>{MONTH_NAMES[month - 1]} {year}</Text>
          <Ionicons name="chevron-forward" size={16} color={T.textDim} style={styles.fieldChevron} />
        </View>
      </Pressable>

      {submitError ? (
        <View style={styles.errorWrap}>
          <Ionicons name="warning-outline" size={15} color={T.red} />
          <Text style={styles.errorText}>{submitError}</Text>
        </View>
      ) : null}

      <Pressable style={[styles.submitBtn, !canSubmit && styles.submitBtnDisabled]} onPress={onSubmit} disabled={!canSubmit}>
        {submitting ? (
          <ActivityIndicator size="small" color={T.onAccent} />
        ) : (
          <>
            <Ionicons name="flash" size={17} color={T.onAccent} />
            <Text style={styles.submitTxt}>{parsedAmount > 0 ? `Log ${fmt(parsedAmount, currency)}` : "Log Expense"}</Text>
          </>
        )}
      </Pressable>
    </ScrollView>
  );
}
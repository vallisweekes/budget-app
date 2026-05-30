import React from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { UnplannedExpenseFormProps } from "@/types";
import { fmt } from "@/lib/formatting";
import { T } from "@/lib/theme";
import MoneyInput from "@/components/Shared/MoneyInput";

import ScanReceiptShortcut from "./ScanReceiptShortcut";
import { styles } from "./style";

export default function UnplannedExpenseForm({
  amount,
  canSubmit,
  currency,
  fundingLabel,
  fundingSource,
  loadingData,
  name,
  needsDebtChoice,
  newLoanName,
  parsedAmount,
  periodLabel,
  selectedCategory,
  selectedDebt,
  submitError,
  submitting,
  topContentInset,
  usingNewLoan,
  onAmountChange,
  onCategoryPress,
  onDebtPress,
  onDescriptionChange,
  onFundingPress,
  onPeriodPress,
  onNewLoanNameChange,
  onScanReceiptPress,
  onSubmit,
}: UnplannedExpenseFormProps) {
  const insets = useSafeAreaInsets();

  if (loadingData) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={T.accent} />
      </View>
    );
  }

  return (
    <View style={styles.flex}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: topContentInset,
            paddingBottom: 150 + Math.max(insets.bottom, 12),
          },
        ]}
        contentInsetAdjustmentBehavior="never"
        keyboardShouldPersistTaps="handled"
      >
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

        <Pressable style={styles.fieldCard} onPress={onPeriodPress}>
          <Text style={styles.fieldLabel}>Period</Text>
          <View style={styles.fieldRow}>
            <Text style={styles.fieldValue}>{periodLabel}</Text>
            <Ionicons name="chevron-forward" size={16} color={T.textDim} style={styles.fieldChevron} />
          </View>
        </Pressable>

        {submitError ? (
          <View style={styles.errorWrap}>
            <Ionicons name="warning-outline" size={15} color={T.red} />
            <Text style={styles.errorText}>{submitError}</Text>
          </View>
        ) : null}
      </ScrollView>

      <View pointerEvents="box-none" style={styles.footerOverlay}>
        <BlurView intensity={20} tint="dark" style={styles.footerBackdrop} pointerEvents="none" />
        <View style={styles.footerBackdropTint} pointerEvents="none" />
        <View style={[styles.footerInner, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <Pressable
            style={({ pressed }) => [styles.submitBtn, pressed && styles.submitBtnPressed, (!canSubmit || submitting) && styles.submitBtnDisabled]}
            onPress={onSubmit}
            disabled={!canSubmit || submitting}
          >
            <BlurView intensity={34} tint="light" style={styles.submitBtnGlass}>
              <View style={styles.submitBtnTint} pointerEvents="none" />
              <View style={styles.submitBtnGlow} pointerEvents="none" />
              <View style={styles.submitBtnInnerBorder} pointerEvents="none" />
              {submitting ? (
                <ActivityIndicator size="small" color={T.text} />
              ) : (
                <View style={styles.submitBtnContent}>
                  <Text style={styles.submitTxt}>{parsedAmount > 0 ? `Log ${fmt(parsedAmount, currency)}` : "Log Expense"}</Text>
                </View>
              )}
            </BlurView>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
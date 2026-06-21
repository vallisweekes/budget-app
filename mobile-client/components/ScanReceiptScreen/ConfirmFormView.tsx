import React from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { s } from "@/components/ScanReceiptScreen/style";
import { fmt } from "@/lib/formatting";
import { T } from "@/lib/theme";
import MoneyInput from "@/components/Shared/MoneyInput";

type Props = {
  topOffset: number;
  previewUri: string | null;
  settingsCurrency?: string | null;
  amount: string;
  onAmountChange: (value: string) => void;
  name: string;
  onNameChange: (value: string) => void;
  selectedCategoryName: string | null;
  selectedCategoryColor?: string | null;
  onOpenCategory: () => void;
  fundingLabel: string;
  onOpenFunding: () => void;
  needsDebtChoice: boolean;
  fundingSource: string;
  selectedDebtName: string | null;
  usingNewLoan: boolean;
  onOpenDebt: () => void;
  newLoanName: string;
  onNewLoanNameChange: (value: string) => void;
  monthLabel: string;
  onOpenMonth: () => void;
  saveError: string | null;
  canSave: boolean;
  saving: boolean;
  onConfirm: () => void;
  parsedAmount: number;
  currency: string;
};

export function ConfirmFormView({
  topOffset,
  previewUri,
  settingsCurrency,
  amount,
  onAmountChange,
  name,
  onNameChange,
  selectedCategoryName,
  selectedCategoryColor,
  onOpenCategory,
  fundingLabel,
  onOpenFunding,
  needsDebtChoice,
  fundingSource,
  selectedDebtName,
  usingNewLoan,
  onOpenDebt,
  newLoanName,
  onNewLoanNameChange,
  monthLabel,
  onOpenMonth,
  saveError,
  canSave,
  saving,
  onConfirm,
  parsedAmount,
  currency,
}: Props) {
  return (
    <SafeAreaView style={s.safe} edges={[]}>
      <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView style={s.flex} contentContainerStyle={[s.scrollContent, { paddingTop: topOffset + 12 }]} keyboardShouldPersistTaps="handled">
          {previewUri ? (
            <View style={s.thumbWrap}>
              <Image source={{ uri: previewUri }} style={s.thumb} resizeMode="contain" />
              <View style={s.thumbBadge}>
                <Ionicons name="checkmark-circle" size={16} color={T.green} />
                <Text style={s.thumbBadgeTxt}>Receipt scanned</Text>
              </View>
            </View>
          ) : null}

          <View style={s.amountCard}>
            <View style={s.amountLabelRow}>
              <Ionicons name="receipt-outline" size={14} color={T.accent} />
              <Text style={s.amountLabel}>Total amount</Text>
            </View>
            <MoneyInput
              currency={settingsCurrency ?? undefined}
              value={amount}
              onChangeValue={onAmountChange}
              placeholder="0.00"
              placeholderTextColor={`${T.text}33`}
              returnKeyType="done"
              editable={!saving}
            />
          </View>

          <View style={s.fieldCard}>
            <Text style={s.fieldLabel}>Merchant / Description</Text>
            <TextInput
              style={s.fieldInput}
              value={name}
              onChangeText={onNameChange}
              placeholder="e.g. Tesco, Costa Coffee..."
              placeholderTextColor={T.textMuted}
              returnKeyType="done"
              maxLength={80}
              editable={!saving}
            />
          </View>

          <Pressable style={s.fieldCard} onPress={onOpenCategory}>
            <Text style={s.fieldLabel}>Category</Text>
            <View style={s.fieldRow}>
              {selectedCategoryName ? (
                <>
                  <View style={[s.catDot, { backgroundColor: selectedCategoryColor ?? T.accentDim }]} />
                  <Text style={s.fieldValue}>{selectedCategoryName}</Text>
                </>
              ) : (
                <Text style={s.fieldPlaceholder}>Select a category</Text>
              )}
              <Ionicons name="chevron-forward" size={16} color={T.textDim} style={s.fieldChevron} />
            </View>
          </Pressable>

          <Pressable style={s.fieldCard} onPress={onOpenFunding}>
            <Text style={s.fieldLabel}>Funds From</Text>
            <View style={s.fieldRow}>
              <Text style={s.fieldValue}>{fundingLabel}</Text>
              <Ionicons name="chevron-forward" size={16} color={T.textDim} style={s.fieldChevron} />
            </View>
          </Pressable>

          {needsDebtChoice ? (
            <Pressable style={s.fieldCard} onPress={onOpenDebt}>
              <Text style={s.fieldLabel}>{fundingSource === "credit_card" ? "Credit Card" : "Loan"}</Text>
              <View style={s.fieldRow}>
                {selectedDebtName ? <Text style={s.fieldValue}>{selectedDebtName}</Text> : usingNewLoan ? <Text style={s.fieldValue}>Create new loan</Text> : <Text style={s.fieldPlaceholder}>{fundingSource === "credit_card" ? "Select a card" : "Select existing or create new loan"}</Text>}
                <Ionicons name="chevron-forward" size={16} color={T.textDim} style={s.fieldChevron} />
              </View>
            </Pressable>
          ) : null}

          {usingNewLoan ? (
            <View style={s.fieldCard}>
              <Text style={s.fieldLabel}>New Loan Name</Text>
              <TextInput
                style={s.fieldInput}
                value={newLoanName}
                onChangeText={onNewLoanNameChange}
                placeholder="e.g. Family loan"
                placeholderTextColor={T.textMuted}
                returnKeyType="done"
                maxLength={80}
                editable={!saving}
              />
            </View>
          ) : null}

          <Pressable style={s.fieldCard} onPress={onOpenMonth}>
            <Text style={s.fieldLabel}>Month</Text>
            <View style={s.fieldRow}>
              <Text style={s.fieldValue}>{monthLabel}</Text>
              <Ionicons name="chevron-forward" size={16} color={T.textDim} style={s.fieldChevron} />
            </View>
          </Pressable>

          {saveError ? (
            <View style={s.errorWrap}>
              <Ionicons name="warning-outline" size={15} color={T.red} />
              <Text style={s.errorText}>{saveError}</Text>
            </View>
          ) : null}

          <Pressable style={[s.submitBtn, (!canSave || saving) && s.submitBtnDisabled]} onPress={onConfirm} disabled={!canSave || saving}>
            {saving ? (
              <ActivityIndicator size="small" color={T.onAccent} />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={18} color={T.onAccent} />
                <Text style={s.submitTxt}>{parsedAmount > 0 ? `Save ${fmt(parsedAmount, currency)}` : "Save Expense"}</Text>
              </>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

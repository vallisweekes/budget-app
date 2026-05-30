import React from "react";
import { Text, TextInput, View } from "react-native";

import { useAppTranslation } from "@/hooks";
import type { GoalDetailFormProps } from "@/types";
import { fmt } from "@/lib/formatting";
import { T } from "@/lib/theme";
import MoneyInput from "@/components/Shared/MoneyInput";
import NumericInput from "@/components/Shared/NumericInput";

import { styles } from "./style";

export default function GoalDetailForm(props: GoalDetailFormProps) {
  const {
    title,
    description,
    targetAmount,
    targetYear,
    currentAmountDraft,
    currentAmount,
    currentAmountEditable,
    currentAmountHint,
    currentAmountLabel,
    currency,
    disabled,
    onCurrentAmountChange,
    onTitleChange,
    onDescriptionChange,
    onTargetAmountChange,
    onTargetYearChange,
  } = props;
  const { t } = useAppTranslation();

  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>{t("goals.detail.title")}</Text>

      <Text style={styles.inputLabel}>{t("goals.field.name")}</Text>
      <TextInput
        value={title}
        onChangeText={onTitleChange}
        placeholder={t("goals.field.name")}
        placeholderTextColor={T.textMuted}
        style={styles.input}
        editable={!disabled}
      />

      <Text style={styles.inputLabel}>{t("goals.field.description")}</Text>
      <TextInput
        value={description}
        onChangeText={onDescriptionChange}
        placeholder={t("goals.field.descriptionPlaceholder")}
        placeholderTextColor={T.textMuted}
        style={[styles.input, styles.inputMultiline]}
        editable={!disabled}
        multiline
        textAlignVertical="top"
      />

      <View style={styles.row2}>
        <View style={styles.rowItem}>
          <Text style={styles.inputLabel}>{t("goals.field.targetAmount")}</Text>
          <MoneyInput
            currency={currency}
            value={targetAmount}
            onChangeValue={onTargetAmountChange}
            placeholder={t("goals.field.targetAmountPlaceholder")}
            editable={!disabled}
          />
        </View>
        <View style={styles.rowItem}>
          <Text style={styles.inputLabel}>{currentAmountLabel}</Text>
          {currentAmountEditable ? (
            <>
              <MoneyInput
                currency={currency}
                value={currentAmountDraft}
                onChangeValue={onCurrentAmountChange}
                placeholder="0.00"
                editable={!disabled}
              />
              <Text style={styles.readOnlyValueHint}>{currentAmountHint}</Text>
            </>
          ) : (
            <View style={styles.readOnlyValueCard}>
              <Text style={styles.readOnlyValueText}>{fmt(currentAmount, currency ?? undefined)}</Text>
              <Text style={styles.readOnlyValueHint}>{currentAmountHint}</Text>
            </View>
          )}
        </View>
      </View>

      <Text style={styles.inputLabel}>{t("goals.field.targetYear")}</Text>
      <NumericInput
        value={targetYear}
        onChangeText={onTargetYearChange}
        placeholder={t("goals.field.targetYearPlaceholder")}
        placeholderTextColor={T.textMuted}
        style={styles.input}
        keyboardType="number-pad"
        editable={!disabled}
      />
    </View>
  );
}
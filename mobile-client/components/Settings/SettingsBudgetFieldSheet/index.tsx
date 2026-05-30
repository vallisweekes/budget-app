import React from "react";
import { Animated, KeyboardAvoidingView, Modal, Platform, Pressable, Text, View } from "react-native";

import NumericInput from "@/components/Shared/NumericInput";
import { useAppTranslation } from "@/hooks";

import { styles } from "./styles";

import type { SettingsBudgetFieldSheetProps } from "@/types/components/settings/SettingsBudgetFieldSheet.types";

export default function SettingsBudgetFieldSheet(props: SettingsBudgetFieldSheetProps) {
  const {
    field,
    keyboardOffset,
    translateY,
    panHandlers,
    payDateDraft,
    horizonDraft,
    payFrequencyDraft,
    payFrequencyOptions,
    saveBusy,
    onClose,
    onChangePayDate,
    onChangeHorizon,
    onChangePayFrequency,
    onSave,
  } = props;
  const { t } = useAppTranslation();

  const getPayFrequencyLabel = (value: typeof payFrequencyDraft) => {
    if (value === "weekly") return t("settings.payFrequency.weekly");
    if (value === "every_2_weeks") return t("settings.payFrequency.every2Weeks");
    if (value === "every_4_weeks") return t("settings.payFrequency.every4Weeks");
    return t("settings.payFrequency.monthly");
  };

  return (
    <Modal transparent visible={field !== null} animationType="slide" onRequestClose={onClose}>
      <View style={styles.sheetOverlay}>
        <Pressable style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }} onPress={onClose} />
        <KeyboardAvoidingView style={styles.sheetKeyboardWrap} behavior={Platform.OS === "ios" ? "padding" : "height"} keyboardVerticalOffset={keyboardOffset}>
          <Animated.View style={[styles.sheet, { transform: [{ translateY }] }]} {...panHandlers}>
            <View style={styles.sheetHandle} {...panHandlers} />
            <Text style={styles.sheetTitle}>{field === "payDate" ? t("settings.budgetSheet.editPayDate") : field === "horizon" ? t("settings.budgetSheet.editHorizon") : t("settings.budgetSheet.editSchedule")}</Text>
            {field === "payDate" ? (<><Text style={styles.label}>{t("settings.budget.payDate")}</Text><NumericInput value={payDateDraft} onChangeText={onChangePayDate} style={styles.input} keyboardType="number-pad" /></>) : null}
            {field === "horizon" ? (<><Text style={styles.label}>{t("settings.budgetSheet.horizonYears")}</Text><NumericInput value={horizonDraft} onChangeText={onChangeHorizon} style={styles.input} keyboardType="number-pad" /></>) : null}
            {field === "payFrequency" ? (
              <>
                <Text style={styles.label}>{t("settings.budget.paySchedule")}</Text>
                <View style={styles.choiceRow}>
                  {payFrequencyOptions.map((option) => {
                    const selected = payFrequencyDraft === option.value;
                    return (
                      <Pressable key={option.value} onPress={() => onChangePayFrequency(option.value)} style={[styles.choiceBtn, selected && styles.choiceBtnActive]}>
                        <Text style={[styles.choiceTxt, selected && styles.choiceTxtActive]}>{getPayFrequencyLabel(option.value)}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </>
            ) : null}
            <View style={styles.sheetActions}>
              <Pressable style={styles.outlineBtnWide} onPress={onClose}><Text style={styles.outlineBtnText}>{t("common.cancel")}</Text></Pressable>
              <Pressable style={[styles.primaryBtnWide, saveBusy && styles.disabled]} onPress={onSave} disabled={saveBusy}><Text style={styles.primaryBtnText}>{saveBusy ? `${t("common.save")}...` : t("common.save")}</Text></Pressable>
            </View>
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

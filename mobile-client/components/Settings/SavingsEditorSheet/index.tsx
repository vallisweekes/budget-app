import React from "react";
import { Animated, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import MoneyInput from "@/components/Shared/MoneyInput";
import NoteBadge from "@/components/Shared/NoteBadge";
import { useAppTranslation } from "@/hooks";
import { INVESTMENT_BUCKET_OPTIONS } from "@/lib/constants";
import type { SavingsEditorSheetProps } from "@/types/components/settings/SavingsEditorSheet.types";
import { styles } from "./styles";
import { T } from "@/lib/theme";

export default function SavingsEditorSheet(props: SavingsEditorSheetProps) {
  const {
    visible,
    mode,
    field,
    icon,
    title,
    currency,
    currentAmount,
    valueDraft,
    potNameDraft,
    goalImpactNote,
    saveBusy,
    insetsBottom,
    keyboardOffset,
    translateY,
    panHandlers,
    formatMoneyText,
    parseMoneyNumber,
    onClose,
    onChangeValue,
    onChangePotName,
    onDelete,
    onSave,
  } = props;
  const { t } = useAppTranslation();

  const showInvestmentBuckets = mode === "add" && field === "investment";
  const potNamePlaceholder = showInvestmentBuckets
    ? t("settings.savingsEditor.investmentPlaceholder")
    : t("settings.savingsEditor.defaultPlaceholder");

  return (
    <Modal transparent visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.sheetOverlay}>
        <Pressable style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }} onPress={onClose} />
        <KeyboardAvoidingView style={styles.sheetKeyboardWrap} behavior={Platform.OS === "ios" ? "padding" : "height"} keyboardVerticalOffset={keyboardOffset}>
          <Animated.View
            style={[styles.sheet, styles.sheetTall, styles.moneyEditorSheet, { transform: [{ translateY }] }]}
            {...panHandlers}
          >
            <View style={styles.sheetHandle} {...panHandlers} />
            <Text style={styles.sheetTitle}>{mode === "add" ? t("settings.savingsEditor.addPot", { title }) : t("settings.savingsEditor.editTitle", { title })}</Text>
            <View style={styles.sheetBody}>
              <ScrollView
                style={styles.sheetScroll}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
                automaticallyAdjustKeyboardInsets={Platform.OS === "ios"}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.sheetScrollContent}
              >
                <View style={styles.moneyEditorHeader}>
                  <View style={styles.moneyEditorIconCircle}>
                    <Ionicons name={icon} size={22} color="#f3f2ff" />
                  </View>
                  <Text style={styles.moneyEditorHeroTitle}>{mode === "add" ? t("settings.savingsEditor.newAmount") : potNameDraft || title}</Text>
                  <Text style={styles.moneyEditorHeroValue}>{formatMoneyText(parseMoneyNumber(valueDraft))}</Text>
                </View>

                <View style={styles.moneyEditorStatsRow}>
                  <View style={styles.moneyEditorStatCard}>
                    <Text style={styles.moneyEditorStatLabel}>{t("settings.savingsEditor.current")}</Text>
                    <Text style={styles.moneyEditorStatValue}>{formatMoneyText(currentAmount)}</Text>
                  </View>
                  <View style={styles.moneyEditorStatCard}>
                    <Text style={styles.moneyEditorStatLabel}>{t("settings.savingsEditor.new")}</Text>
                    <Text style={styles.moneyEditorStatValue}>{formatMoneyText(parseMoneyNumber(valueDraft))}</Text>
                  </View>
                </View>

                {mode === "add" ? (
                  <>
                    {showInvestmentBuckets ? (
                      <>
                        <Text style={styles.label}>{t("settings.savingsEditor.chooseInvestmentBucket")}</Text>
                        <View style={styles.presetWrap}>
                          {INVESTMENT_BUCKET_OPTIONS.map((option) => {
                            const active = potNameDraft.trim().toLowerCase() === option.toLowerCase();

                            return (
                              <Pressable
                                key={option}
                                onPress={() => onChangePotName(option)}
                                style={[styles.presetPill, active && styles.presetPillActive]}
                              >
                                <Text style={[styles.presetPillText, active && styles.presetPillTextActive]}>{option}</Text>
                              </Pressable>
                            );
                          })}
                        </View>
                      </>
                    ) : null}

                    <Text style={styles.label}>{t("settings.savingsEditor.potName")}</Text>
                    <TextInput
                      value={potNameDraft}
                      onChangeText={onChangePotName}
                      style={styles.input}
                      placeholder={potNamePlaceholder}
                      placeholderTextColor={T.textMuted}
                    />
                  </>
                ) : null}

                <Text style={styles.label}>{t("settings.savingsEditor.amount")}</Text>
                <MoneyInput currency={currency} value={valueDraft} onChangeValue={onChangeValue} />

                {goalImpactNote ? <NoteBadge text={goalImpactNote} /> : null}
              </ScrollView>

              <View style={[styles.sheetActionsDocked, styles.moneyEditorDockedActions, { paddingBottom: Math.max(12, insetsBottom + 6) }]}> 
                {mode === "edit" ? (
                  <Pressable style={[styles.moneyDeleteBtn, saveBusy && styles.disabled]} onPress={onDelete} disabled={saveBusy}><Text style={styles.moneyDeleteBtnText}>{t("settings.savingsEditor.delete")}</Text></Pressable>
                ) : (
                  <Pressable style={styles.outlineBtnWide} onPress={onClose}><Text style={styles.outlineBtnText}>{t("common.cancel")}</Text></Pressable>
                )}
                <Pressable style={[styles.primaryBtnWide, saveBusy && styles.disabled]} onPress={onSave} disabled={saveBusy}><Text style={styles.primaryBtnText}>{saveBusy ? `${t("common.save")}...` : mode === "add" ? t("common.add") : t("common.save")}</Text></Pressable>
              </View>
            </View>
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

import React from "react";
import { Animated, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import GlassFooterButton from "@/components/Shared/GlassFooterButton";
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
    brokerDraft,
    showBrokerField,
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
    onChangeBroker,
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
        <View style={styles.sheetKeyboardWrap}>
          <Animated.View
            style={[styles.sheet, styles.sheetTall, styles.moneyEditorSheet, { transform: [{ translateY }] }]}
            {...panHandlers}
          >
            <View style={styles.sheetHandle} {...panHandlers} />
            <Text style={styles.sheetTitle}>{mode === "add" ? t("settings.savingsEditor.addPot", { title }) : t("settings.savingsEditor.editTitle", { title })}</Text>
            <View style={styles.sheetBody}>
              <KeyboardAvoidingView
                style={styles.sheetContentWrap}
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                keyboardVerticalOffset={keyboardOffset}
              >
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

                {showBrokerField ? (
                  <>
                    <Text style={styles.label}>{t("settings.savingsEditor.broker")}</Text>
                    <TextInput
                      value={brokerDraft}
                      onChangeText={onChangeBroker}
                      style={styles.input}
                      placeholder={t("settings.savingsEditor.brokerPlaceholder")}
                      placeholderTextColor={T.textMuted}
                    />
                  </>
                ) : null}

                <Text style={styles.label}>{t("settings.savingsEditor.amount")}</Text>
                <MoneyInput currency={currency} value={valueDraft} onChangeValue={onChangeValue} />

                {goalImpactNote ? <NoteBadge text={goalImpactNote} /> : null}
              </ScrollView>
              </KeyboardAvoidingView>

              <View style={[styles.sheetActionsDocked, styles.moneyEditorDockedActions, { paddingBottom: Math.max(12, insetsBottom + 6) }]}> 
                <GlassFooterButton
                  label={mode === "edit" ? t("settings.savingsEditor.delete") : t("common.cancel")}
                  onPress={mode === "edit" ? onDelete : onClose}
                  disabled={saveBusy}
                  variant="dark"
                  tone={mode === "edit" ? "danger" : "light"}
                  containerStyle={styles.footerActionButton}
                />
                <GlassFooterButton
                  label={mode === "add" ? t("common.add") : t("common.save")}
                  onPress={onSave}
                  disabled={saveBusy}
                  loading={saveBusy}
                  variant="light"
                  tone="dark"
                  containerStyle={styles.footerActionButton}
                />
              </View>
            </View>
          </Animated.View>
        </View>
      </View>
    </Modal>
  );
}

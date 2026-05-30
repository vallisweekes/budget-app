import React from "react";
import { Animated, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, View } from "react-native";

import { useAppTranslation } from "@/hooks";
import { styles } from "./styles";

import { DEFAULT_LANGUAGE, getCountryLabel, getLanguageLabel, LOCALE_PRESET_OPTIONS, normalizeSupportedLanguage, resolveDefaultLanguageForCountry, SUPPORTED_LANGUAGE_OPTIONS } from "@/lib/constants";
import { fmt } from "@/lib/formatting";
import { resolveCurrencyCodeForCountry } from "@/lib/helpers/settings";
import type { SettingsLocaleSheetProps } from "@/types/components/settings/SettingsLocaleSheet.types";

export default function SettingsLocaleSheet({ visible, keyboardOffset, translateY, panHandlers, countryDraft, languageDraft, detectedCountry, saveBusy, onClose, onChangeCountry, onChangeLanguage, onSave }: SettingsLocaleSheetProps) {
  const normalizedCountryDraft = React.useMemo(() => String(countryDraft ?? "").trim().toUpperCase(), [countryDraft]);
  const normalizedLanguageDraft = React.useMemo(() => normalizeSupportedLanguage(languageDraft, DEFAULT_LANGUAGE), [languageDraft]);
  const { t } = useAppTranslation(normalizedLanguageDraft);

  const selectedOption = React.useMemo(() => {
    const matched = LOCALE_PRESET_OPTIONS.find((option) => option.countryCode === normalizedCountryDraft);
    if (matched) return matched;
    if (!normalizedCountryDraft) return null;

    return {
      countryCode: normalizedCountryDraft,
      countryLabel: `Saved country (${normalizedCountryDraft})`,
      currencyCode: resolveCurrencyCodeForCountry(normalizedCountryDraft),
      currencyLabel: "Saved locale",
    };
  }, [normalizedCountryDraft]);

  const previewCurrencyCode = selectedOption?.currencyCode ?? resolveCurrencyCodeForCountry(normalizedCountryDraft);
  const detectedCountryLabel = detectedCountry ? (getCountryLabel(detectedCountry) ?? detectedCountry) : t("settings.locale.unknownCountry");
  const canSave = Boolean(normalizedCountryDraft) && Boolean(normalizedLanguageDraft) && !saveBusy;

  const handleCountryChange = (nextCountry: string) => {
    const currentDefaultLanguage = resolveDefaultLanguageForCountry(normalizedCountryDraft);
    const nextDefaultLanguage = resolveDefaultLanguageForCountry(nextCountry);
    onChangeCountry(nextCountry.toUpperCase());
    if (!normalizedLanguageDraft || normalizedLanguageDraft === currentDefaultLanguage) {
      onChangeLanguage(nextDefaultLanguage);
    }
  };

  return (
    <Modal transparent visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.sheetOverlay}>
        <Pressable style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }} onPress={onClose} />
        <KeyboardAvoidingView style={styles.sheetKeyboardWrap} behavior={Platform.OS === "ios" ? "padding" : "height"} keyboardVerticalOffset={keyboardOffset}>
          <Animated.View style={[styles.sheet, { transform: [{ translateY }] }]} {...panHandlers}>
            <View style={styles.sheetHandle} {...panHandlers} />
            <Text style={styles.sheetTitle}>{t("settings.locale.sheetTitle")}</Text>

            <ScrollView style={styles.sheetScroll} contentContainerStyle={styles.sheetScrollContent} showsVerticalScrollIndicator={false}>
              <View style={styles.sectionWrap}>
                <Text style={styles.label}>{t("settings.locale.sheetCountryPicker")}</Text>
                <View style={styles.optionGrid}>
                  {LOCALE_PRESET_OPTIONS.map((option) => {
                    const active = option.countryCode === normalizedCountryDraft;
                    return (
                      <Pressable
                        key={option.countryCode}
                        style={[styles.optionChip, active ? styles.optionChipActive : null]}
                        onPress={() => handleCountryChange(option.countryCode)}
                      >
                        <Text style={[styles.optionChipText, active ? styles.optionChipTextActive : null]}>{option.countryLabel}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <View style={styles.sectionWrap}>
                <Text style={styles.label}>{t("settings.locale.sheetLanguagePicker")}</Text>
                <View style={styles.optionGrid}>
                  {SUPPORTED_LANGUAGE_OPTIONS.map((option) => {
                    const active = option.code === normalizedLanguageDraft;
                    return (
                      <Pressable
                        key={option.code}
                        style={[styles.optionChip, active ? styles.optionChipActive : null]}
                        onPress={() => onChangeLanguage(option.code)}
                      >
                        <Text style={[styles.optionChipText, active ? styles.optionChipTextActive : null]}>{option.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <View style={styles.previewCard}>
                <Text style={styles.previewEyebrow}>{t("settings.locale.sheetPreview")}</Text>
                <Text style={styles.previewAmount}>{fmt(1234.56, previewCurrencyCode)}</Text>
                <View style={styles.previewMetaList}>
                  <View style={styles.previewMetaRow}>
                    <Text style={styles.previewMetaLabel}>{t("settings.locale.sheetPreviewLocale")}</Text>
                    <Text style={styles.previewMetaValue}>{selectedOption?.countryLabel ?? normalizedCountryDraft}</Text>
                  </View>
                  <View style={styles.previewMetaRow}>
                    <Text style={styles.previewMetaLabel}>{t("settings.locale.sheetPreviewLanguage")}</Text>
                    <Text style={styles.previewMetaValue}>{getLanguageLabel(normalizedLanguageDraft)}</Text>
                  </View>
                  <View style={styles.previewMetaRow}>
                    <Text style={styles.previewMetaLabel}>{t("settings.locale.sheetPreviewCurrency")}</Text>
                    <Text style={styles.previewMetaValue}>{previewCurrencyCode}</Text>
                  </View>
                </View>
                <Text style={styles.previewText}>{t("settings.locale.sheetCurrencyDerived")}</Text>
              </View>

              <Text style={styles.muted}>{t("settings.locale.detectedCountry", { country: detectedCountryLabel })}</Text>
            </ScrollView>

            <View style={styles.sheetActions}>
              <Pressable style={styles.outlineBtnWide} onPress={onClose}><Text style={styles.outlineBtnText}>{t("common.cancel")}</Text></Pressable>
              <Pressable style={[styles.primaryBtnWide, !canSave && styles.disabled]} onPress={onSave} disabled={!canSave}><Text style={styles.primaryBtnText}>{saveBusy ? `${t("common.save")}…` : t("common.save")}</Text></Pressable>
            </View>
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

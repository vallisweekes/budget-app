import React from "react";
import { Animated, KeyboardAvoidingView, Modal, Platform, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { styles } from "./styles";

import { LOCALE_PRESET_OPTIONS } from "@/lib/constants";
import { fmt } from "@/lib/formatting";
import { resolveCurrencyCodeForCountry } from "@/lib/helpers/settings";
import type { SettingsLocaleSheetProps } from "@/types/components/settings/SettingsLocaleSheet.types";

export default function SettingsLocaleSheet({ visible, keyboardOffset, translateY, panHandlers, countryDraft, detectedCountry, saveBusy, onClose, onChangeCountry, onSave }: SettingsLocaleSheetProps) {
  const normalizedCountryDraft = React.useMemo(() => String(countryDraft ?? "").trim().toUpperCase(), [countryDraft]);
  const [pickerOpen, setPickerOpen] = React.useState(false);

  React.useEffect(() => {
    if (visible) {
      setPickerOpen(false);
    }
  }, [visible]);

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

  const currencyOptions = React.useMemo(() => {
    const seen = new Set<string>();

    return LOCALE_PRESET_OPTIONS.filter((option) => {
      if (seen.has(option.currencyCode)) return false;
      seen.add(option.currencyCode);
      return true;
    });
  }, []);

  const previewCurrencyCode = selectedOption?.currencyCode ?? resolveCurrencyCodeForCountry(normalizedCountryDraft);
  const canSave = Boolean(normalizedCountryDraft) && !saveBusy;

  return (
    <Modal transparent visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.sheetOverlay}>
        <Pressable style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }} onPress={onClose} />
        <KeyboardAvoidingView style={styles.sheetKeyboardWrap} behavior={Platform.OS === "ios" ? "padding" : "height"} keyboardVerticalOffset={keyboardOffset}>
          <Animated.View style={[styles.sheet, { transform: [{ translateY }] }]} {...panHandlers}>
            <View style={styles.sheetHandle} {...panHandlers} />
            <Text style={styles.sheetTitle}>Edit locale</Text>
            <Text style={styles.label}>Quick locale selector</Text>

            <Pressable style={styles.selectorButton} onPress={() => setPickerOpen((value) => !value)}>
              <View style={styles.selectorBody}>
                <Text style={styles.selectorTitle}>{selectedOption?.currencyCode ?? "Choose a locale"}</Text>
                <Text style={styles.selectorSubtitle}>
                  {selectedOption ? `${selectedOption.currencyLabel}` : "Pick a currency code"}
                </Text>
              </View>
              <Ionicons name={pickerOpen ? "chevron-up" : "chevron-down"} size={18} color={styles.selectorIcon.color as string} />
            </Pressable>

            {pickerOpen ? (
              <View style={styles.optionGrid}>
                {currencyOptions.map((option) => {
                  const active = option.currencyCode === previewCurrencyCode;
                  return (
                    <Pressable
                      key={option.currencyCode}
                      style={[styles.optionChip, active ? styles.optionChipActive : null]}
                      onPress={() => {
                        onChangeCountry(option.countryCode);
                        setPickerOpen(false);
                      }}
                    >
                      <Text style={[styles.optionChipText, active ? styles.optionChipTextActive : null]}>{option.currencyCode}</Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}

            <View style={styles.previewCard}>
              <Text style={styles.previewEyebrow}>Display preview</Text>
              <Text style={styles.previewAmount}>{fmt(1234.56, previewCurrencyCode)}</Text>
              <Text style={styles.previewText}>Changing locale only updates the symbol and number formatting. It does not convert your saved amounts.</Text>
            </View>

            <Text style={styles.muted}>Detected country: {detectedCountry ?? "Unknown"}</Text>
            <Text style={styles.muted}>Currency updates automatically from the selected country.</Text>
            <View style={styles.sheetActions}>
              <Pressable style={styles.outlineBtnWide} onPress={onClose}><Text style={styles.outlineBtnText}>Cancel</Text></Pressable>
              <Pressable style={[styles.primaryBtnWide, !canSave && styles.disabled]} onPress={onSave} disabled={!canSave}><Text style={styles.primaryBtnText}>{saveBusy ? "Saving…" : "Save"}</Text></Pressable>
            </View>
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

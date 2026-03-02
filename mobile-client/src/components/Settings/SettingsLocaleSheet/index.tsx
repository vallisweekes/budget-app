import React from "react";
import { Animated, KeyboardAvoidingView, Modal, Platform, Pressable, Text, TextInput, View } from "react-native";

import { styles } from "./styles";

import type { SettingsLocaleSheetProps } from "@/types/components/settings/SettingsLocaleSheet.types";

export default function SettingsLocaleSheet({ visible, keyboardOffset, translateY, panHandlers, countryDraft, detectedCountry, saveBusy, onClose, onChangeCountry, onSave }: SettingsLocaleSheetProps) {
  return (
    <Modal transparent visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.sheetOverlay}>
        <Pressable style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }} onPress={onClose} />
        <KeyboardAvoidingView style={styles.sheetKeyboardWrap} behavior={Platform.OS === "ios" ? "padding" : "height"} keyboardVerticalOffset={keyboardOffset}>
          <Animated.View style={[styles.sheet, { transform: [{ translateY }] }]} {...panHandlers}>
            <View style={styles.sheetHandle} {...panHandlers} />
            <Text style={styles.sheetTitle}>Edit locale</Text>
            <Text style={styles.label}>Country code</Text>
            <TextInput value={countryDraft} onChangeText={onChangeCountry} style={styles.input} autoCapitalize="characters" maxLength={3} />
            <Text style={styles.muted}>Detected country: {detectedCountry ?? "Unknown"}</Text>
            <View style={styles.sheetActions}>
              <Pressable style={styles.outlineBtnWide} onPress={onClose}><Text style={styles.outlineBtnText}>Cancel</Text></Pressable>
              <Pressable style={[styles.primaryBtnWide, saveBusy && styles.disabled]} onPress={onSave} disabled={saveBusy}><Text style={styles.primaryBtnText}>{saveBusy ? "Saving…" : "Save"}</Text></Pressable>
            </View>
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

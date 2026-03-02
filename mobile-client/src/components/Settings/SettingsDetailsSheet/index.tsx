import React from "react";
import { Animated, KeyboardAvoidingView, Modal, Platform, Pressable, Text, TextInput, View } from "react-native";

import { styles } from "./styles";

import type { SettingsDetailsSheetProps } from "@/types/components/settings/SettingsDetailsSheet.types";

export default function SettingsDetailsSheet({ visible, keyboardOffset, translateY, panHandlers, username, emailDraft, saveBusy, onClose, onChangeEmail, onSave }: SettingsDetailsSheetProps) {
  return (
    <Modal transparent visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.sheetOverlay}>
        <Pressable style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }} onPress={onClose} />
        <KeyboardAvoidingView style={styles.sheetKeyboardWrap} behavior={Platform.OS === "ios" ? "padding" : "height"} keyboardVerticalOffset={keyboardOffset}>
          <Animated.View style={[styles.sheet, { transform: [{ translateY }] }]}> 
            <View style={styles.sheetHandle} {...panHandlers} />
            <Text style={styles.sheetTitle}>Edit details</Text>
            <Text style={styles.label}>Username</Text>
            <TextInput value={username} editable={false} style={styles.inputDisabled} />
            <Text style={styles.label}>Email</Text>
            <TextInput value={emailDraft} onChangeText={onChangeEmail} style={styles.input} keyboardType="email-address" autoCapitalize="none" />
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

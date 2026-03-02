import React from "react";
import { Animated, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";

import MoneyInput from "@/components/Shared/MoneyInput";
import { styles } from "./styles";

import type { SettingsDebtSheetProps } from "@/types/components/settings/SettingsDebtSheet.types";

export default function SettingsDebtSheet(props: SettingsDebtSheetProps) {
  const {
    visible,
    title,
    actionLabel,
    currency,
    insetsBottom,
    keyboardOffset,
    translateY,
    panHandlers,
    name,
    balance,
    interestRate,
    creditLimit,
    saveBusy,
    onClose,
    onChangeName,
    onChangeBalance,
    onChangeInterestRate,
    onChangeCreditLimit,
    onSubmit,
  } = props;

  return (
    <Modal transparent visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.sheetOverlay}>
        <Pressable style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }} onPress={onClose} />
        <KeyboardAvoidingView style={styles.sheetKeyboardWrap} behavior={Platform.OS === "ios" ? "padding" : "height"} keyboardVerticalOffset={keyboardOffset}>
          <Animated.View style={[styles.sheet, styles.sheetTall, { transform: [{ translateY }] }]}> 
            <View style={styles.sheetHandle} {...panHandlers} />
            <Text style={styles.sheetTitle}>{title}</Text>
            <View style={styles.sheetBody}>
              <ScrollView style={styles.sheetScroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={styles.sheetScrollContent}>
                <Text style={styles.label}>Name</Text>
                <TextInput value={name} onChangeText={onChangeName} style={styles.input} />

                <Text style={styles.label}>Balance</Text>
                <MoneyInput currency={currency} value={balance} onChangeValue={onChangeBalance} />

                <Text style={styles.label}>Interest rate % (optional)</Text>
                <TextInput value={interestRate} onChangeText={onChangeInterestRate} style={styles.input} keyboardType="decimal-pad" />

                <Text style={styles.label}>Credit limit</Text>
                <MoneyInput currency={currency} value={creditLimit} onChangeValue={onChangeCreditLimit} />
              </ScrollView>

              <View style={[styles.sheetActionsDocked, { paddingBottom: Math.max(12, insetsBottom + 6) }]}> 
                <Pressable style={styles.outlineBtnWide} onPress={onClose}><Text style={styles.outlineBtnText}>Cancel</Text></Pressable>
                <Pressable style={[styles.primaryBtnWide, saveBusy && styles.disabled]} onPress={onSubmit} disabled={saveBusy}><Text style={styles.primaryBtnText}>{saveBusy ? "Saving…" : actionLabel}</Text></Pressable>
              </View>
            </View>
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

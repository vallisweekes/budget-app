import React from "react";
import { Animated, Modal, Pressable, Text, TextInput, View } from "react-native";

import { styles } from "./styles";

import type { SettingsBudgetFieldSheetProps } from "@/types/components/settings/SettingsBudgetFieldSheet.types";

export default function SettingsBudgetFieldSheet(props: SettingsBudgetFieldSheetProps) {
  const {
    field,
    translateY,
    panHandlers,
    payDateDraft,
    horizonDraft,
    payFrequencyDraft,
    billFrequencyDraft,
    payFrequencyOptions,
    billFrequencyOptions,
    saveBusy,
    onClose,
    onChangePayDate,
    onChangeHorizon,
    onChangePayFrequency,
    onChangeBillFrequency,
    onSave,
  } = props;

  return (
    <Modal transparent visible={field !== null} animationType="slide" onRequestClose={onClose}>
      <View style={styles.sheetOverlay}>
        <Pressable style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }} onPress={onClose} />
        <Animated.View style={[styles.sheet, { transform: [{ translateY }] }]}>
          <View style={styles.sheetHandle} {...panHandlers} />
          <Text style={styles.sheetTitle}>{field === "payDate" ? "Edit pay date" : field === "horizon" ? "Edit budget horizon" : field === "payFrequency" ? "Edit pay schedule" : "Edit bill schedule"}</Text>
          {field === "payDate" ? (<><Text style={styles.label}>Pay date</Text><TextInput value={payDateDraft} onChangeText={onChangePayDate} style={styles.input} keyboardType="number-pad" /></>) : null}
          {field === "horizon" ? (<><Text style={styles.label}>Budget horizon (years)</Text><TextInput value={horizonDraft} onChangeText={onChangeHorizon} style={styles.input} keyboardType="number-pad" /></>) : null}
          {field === "payFrequency" ? (
            <>
              <Text style={styles.label}>Pay schedule</Text>
              <View style={styles.choiceRow}>
                {payFrequencyOptions.map((option) => {
                  const selected = payFrequencyDraft === option.value;
                  return (
                    <Pressable key={option.value} onPress={() => onChangePayFrequency(option.value)} style={[styles.choiceBtn, selected && styles.choiceBtnActive]}>
                      <Text style={[styles.choiceTxt, selected && styles.choiceTxtActive]}>{option.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </>
          ) : null}
          {field === "billFrequency" ? (
            <>
              <Text style={styles.label}>Bill schedule</Text>
              <View style={styles.choiceRow}>
                {billFrequencyOptions.map((option) => {
                  const selected = billFrequencyDraft === option.value;
                  return (
                    <Pressable key={option.value} onPress={() => onChangeBillFrequency(option.value)} style={[styles.choiceBtn, selected && styles.choiceBtnActive]}>
                      <Text style={[styles.choiceTxt, selected && styles.choiceTxtActive]}>{option.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </>
          ) : null}
          <View style={styles.sheetActions}>
            <Pressable style={styles.outlineBtnWide} onPress={onClose}><Text style={styles.outlineBtnText}>Cancel</Text></Pressable>
            <Pressable style={[styles.primaryBtnWide, saveBusy && styles.disabled]} onPress={onSave} disabled={saveBusy}><Text style={styles.primaryBtnText}>{saveBusy ? "Saving…" : "Save"}</Text></Pressable>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

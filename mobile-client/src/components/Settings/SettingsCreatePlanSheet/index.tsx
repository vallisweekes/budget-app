import React from "react";
import { Animated, KeyboardAvoidingView, Modal, Platform, Pressable, Text, TextInput, View } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";

import DatePickerInput from "@/components/Shared/DatePickerInput";
import { formatDateDmy } from "@/lib/helpers/settings";
import { styles } from "./styles";

import type { SettingsCreatePlanSheetProps } from "@/types/components/settings/SettingsCreatePlanSheet.types";

export default function SettingsCreatePlanSheet(props: SettingsCreatePlanSheetProps) {
  const {
    visible,
    keyboardOffset,
    translateY,
    panHandlers,
    newPlanType,
    newPlanName,
    newPlanEventDate,
    showPlanEventDatePicker,
    saveBusy,
    onClose,
    onChangePlanType,
    onChangePlanName,
    onOpenDatePicker,
    onCloseDatePicker,
    onAndroidDateChange,
    onCreate,
  } = props;

  return (
    <Modal transparent visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.sheetOverlay}>
        <Pressable style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }} onPress={onClose} />
        <KeyboardAvoidingView style={styles.sheetKeyboardWrap} behavior={Platform.OS === "ios" ? "padding" : "height"} keyboardVerticalOffset={keyboardOffset}>
          <Animated.View style={[styles.sheet, { transform: [{ translateY }] }]} {...panHandlers}>
            <View style={styles.sheetHandle} {...panHandlers} />
            <Text style={styles.sheetTitle}>Create sub plan</Text>
            <Text style={styles.label}>Type</Text>
            <View style={styles.choiceRow}>
              {([
                { label: "Holiday", value: "holiday" },
                { label: "Carnival", value: "carnival" },
              ] as const).map((opt) => {
                const selected = newPlanType === opt.value;
                return (
                  <Pressable key={opt.value} onPress={() => onChangePlanType(opt.value)} style={[styles.choiceBtn, selected && styles.choiceBtnActive]}>
                    <Text style={[styles.choiceTxt, selected && styles.choiceTxtActive]}>{opt.label}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={styles.label}>Plan name</Text>
            <TextInput value={newPlanName} onChangeText={onChangePlanName} style={styles.input} />
            <Text style={styles.label}>Event date (calendar)</Text>
            <DatePickerInput containerStyle={[styles.input, styles.dateInput]} onPress={onOpenDatePicker} value={newPlanEventDate ? formatDateDmy(newPlanEventDate) : ""} valueStyle={styles.dateValue} placeholderStyle={styles.dateValuePlaceholder} />

            {showPlanEventDatePicker && Platform.OS === "android" ? (
              <View style={{ marginBottom: 6 }}>
                <DateTimePicker
                  value={newPlanEventDate ? new Date(`${newPlanEventDate}T00:00:00`) : new Date()}
                  mode="date"
                  display="calendar"
                  minimumDate={new Date()}
                  onChange={(event, selectedDate) => {
                    onCloseDatePicker();
                    if (event.type === "set" && selectedDate) onAndroidDateChange(selectedDate.toISOString().slice(0, 10));
                  }}
                />
              </View>
            ) : null}
            <View style={styles.sheetActions}>
              <Pressable style={styles.outlineBtnWide} onPress={onClose}><Text style={styles.outlineBtnText}>Cancel</Text></Pressable>
              <Pressable style={[styles.primaryBtnWide, saveBusy && styles.disabled]} onPress={onCreate} disabled={saveBusy}><Text style={styles.primaryBtnText}>{saveBusy ? "Creating…" : "Create"}</Text></Pressable>
            </View>
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

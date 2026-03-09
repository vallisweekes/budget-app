import React from "react";
import {
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";

import MoneyInput from "@/components/Shared/MoneyInput";
import DatePickerInput from "@/components/Shared/DatePickerInput";
import OverlaySelectInput from "@/components/Shared/OverlaySelectInput";
import { PAYMENT_SOURCE_OPTIONS, TERM_PRESETS, TYPE_COLORS, TYPE_LABELS } from "@/lib/constants";
import { T } from "@/lib/theme";
import { debtStyles as styles } from "@/components/DebtScreen/style";
import { formatYmdToDmy } from "@/components/DebtScreen/utils";
import type { AddDebtSheetProps } from "@/types";

export function AddDebtSheet({ controller }: AddDebtSheetProps) {
  return (
    <Modal
      visible={controller.showAddForm}
      transparent
      animationType="slide"
      onRequestClose={controller.closeAddDebtSheet}
    >
      <KeyboardAvoidingView
        style={styles.sheetOverlay}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={controller.closeAddDebtSheet} />
        <Animated.View
          style={[
            styles.sheet,
            {
              paddingTop: Math.max(10, controller.insets.top + 8),
              paddingBottom: Math.max(22, controller.insets.bottom + 10),
              transform: [{ translateY: controller.addDebtDragY }],
            },
          ]}
        >
          <View style={styles.sheetHandle} {...controller.addDebtPanHandlers} />
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Add Debt</Text>
            <Pressable onPress={controller.closeAddDebtSheet} hitSlop={10} style={styles.sheetCloseBtn}>
              <Ionicons name="close" size={18} color={T.textDim} />
            </Pressable>
          </View>

          <ScrollView
            style={styles.sheetFormScroll}
            contentContainerStyle={styles.sheetScrollContent}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.addForm}>
              <View style={styles.termWrap}>
                <Text style={styles.termLabel}>Debt name</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Car loan"
                  placeholderTextColor={T.textMuted}
                  value={controller.addName}
                  onChangeText={controller.setAddName}
                  autoFocus
                />
              </View>

              <View style={styles.inlineRow}>
                <View style={[styles.termWrap, { flex: 1 }]}> 
                  <Text style={styles.termLabel}>{controller.isLoanStyleType ? "Loan amount" : "Current balance"}</Text>
                  <MoneyInput
                    currency={controller.settings?.currency}
                    value={controller.addBalance}
                    onChangeValue={controller.setAddBalance}
                    placeholder="0.00"
                  />
                </View>

                <View style={[styles.termWrap, { flex: 1 }]}> 
                  <Text style={styles.termLabel}>Debt type</Text>
                  <OverlaySelectInput
                    containerStyle={styles.dropdownAnchor}
                    triggerStyle={styles.input}
                    value={controller.addType}
                    onChange={controller.setAddType}
                    options={Object.keys(TYPE_LABELS).map((type) => ({
                      value: type,
                      label: TYPE_LABELS[type] ?? type,
                      activeColor: TYPE_COLORS[type],
                    }))}
                    placeholder="Select type"
                  />
                </View>
              </View>

              <View style={styles.inlineRow}>
                <View style={[styles.termWrap, { flex: 1 }]}> 
                  <Text style={styles.termLabel}>Due date (required)</Text>
                  <DatePickerInput
                    containerStyle={styles.input}
                    onPress={() => controller.setShowAddDueDatePicker(true)}
                    value={controller.addDueDate ? formatYmdToDmy(controller.addDueDate) : ""}
                    valueStyle={styles.dateValue}
                    placeholderStyle={styles.dateValuePlaceholder}
                  />
                </View>

                <View style={[styles.termWrap, { flex: 1 }]}> 
                  <Text style={styles.termLabel}>
                    {controller.addInstallmentMonths.trim() ? "Monthly payment (auto)" : "Monthly payment (optional)"}
                  </Text>
                  <MoneyInput
                    currency={controller.settings?.currency}
                    value={controller.addMonthlyPayment}
                    onChangeValue={controller.setAddMonthlyPayment}
                    placeholder="0.00"
                    editable={!controller.addInstallmentMonths.trim()}
                  />
                </View>
              </View>

              {controller.isCardType ? (
                <View style={styles.inlineRow}>
                  <View style={[styles.termWrap, { flex: 1 }]}>
                    <Text style={styles.termLabel}>Credit limit</Text>
                    <MoneyInput
                      currency={controller.settings?.currency}
                      value={controller.addCreditLimit}
                      onChangeValue={controller.setAddCreditLimit}
                      placeholder="0.00"
                    />
                  </View>
                  <View style={[styles.termWrap, { flex: 1 }]}>
                    <Text style={styles.termLabel}>Interest APR % (optional)</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="e.g. 19.9"
                      placeholderTextColor={T.textMuted}
                      value={controller.addInterestRate}
                      onChangeText={controller.setAddInterestRate}
                      keyboardType="decimal-pad"
                    />
                  </View>
                </View>
              ) : (
                <View style={styles.inlineRow}>
                  <View style={[styles.termWrap, { flex: 1 }]}>
                    <Text style={styles.termLabel}>Interest APR % (optional)</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="e.g. 19.9"
                      placeholderTextColor={T.textMuted}
                      value={controller.addInterestRate}
                      onChangeText={controller.setAddInterestRate}
                      keyboardType="decimal-pad"
                    />
                  </View>

                  <View style={[styles.termWrap, { flex: 1 }]}> 
                    <Text style={styles.termLabel}>Payment source</Text>
                    <OverlaySelectInput
                      containerStyle={styles.dropdownAnchor}
                      triggerStyle={styles.input}
                      value={controller.addPaymentSource}
                      onChange={controller.onChangePaymentSource}
                      options={PAYMENT_SOURCE_OPTIONS.map((option) => ({ value: option.value, label: option.label }))}
                      placeholder="Select source"
                    />
                  </View>
                </View>
              )}

              {controller.isCardType ? (
                <View style={styles.termWrap}>
                  <Text style={styles.termLabel}>Payment source</Text>
                  <OverlaySelectInput
                    containerStyle={styles.dropdownAnchor}
                    triggerStyle={styles.input}
                    value={controller.addPaymentSource}
                    onChange={controller.onChangePaymentSource}
                    options={PAYMENT_SOURCE_OPTIONS.map((option) => ({ value: option.value, label: option.label }))}
                    placeholder="Select source"
                  />
                </View>
              ) : null}

              {controller.addPaymentSource === "credit_card" ? (
                <View style={styles.termWrap}>
                  <Text style={styles.termLabel}>Select card</Text>
                  {controller.selectablePaymentCards.length > 0 ? (
                    <View style={styles.cardChoiceWrap}>
                      {controller.selectablePaymentCards.map((card) => {
                        const active = controller.addPaymentCardDebtId === card.id;
                        return (
                          <Pressable
                            key={card.id}
                            onPress={() => controller.setAddPaymentCardDebtId(card.id)}
                            style={[styles.cardChoiceBtn, active && styles.cardChoiceBtnActive]}
                          >
                            <Text style={[styles.cardChoiceTxt, active && styles.cardChoiceTxtActive]} numberOfLines={1}>
                              {card.name}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  ) : (
                    <Text style={styles.cardChoiceEmpty}>No credit/store cards found yet.</Text>
                  )}
                </View>
              ) : null}

              <View style={styles.termWrap}>
                <Text style={styles.termLabel}>Spread over months</Text>
                <View style={styles.termRow}>
                  <Pressable
                    onPress={controller.onClearInstallments}
                    style={[styles.termBtn, controller.addInstallmentPreset == null && !controller.addInstallmentMonths.trim() && styles.termBtnActive]}
                  >
                    <Text style={[styles.termBtnTxt, controller.addInstallmentPreset == null && !controller.addInstallmentMonths.trim() && styles.termBtnTxtActive]}>None</Text>
                  </Pressable>
                  {TERM_PRESETS.map((months) => {
                    const active = controller.addInstallmentPreset === months;
                    return (
                      <Pressable
                        key={months}
                        onPress={() => controller.onSelectInstallmentPreset(months)}
                        style={[styles.termBtn, active && styles.termBtnActive]}
                      >
                        <Text style={[styles.termBtnTxt, active && styles.termBtnTxtActive]}>{`${months} months`}</Text>
                      </Pressable>
                    );
                  })}
                  <Pressable
                    onPress={controller.onSelectCustomInstallmentPreset}
                    style={[styles.termBtn, controller.addInstallmentPreset === "custom" && styles.termBtnActive]}
                  >
                    <Text style={[styles.termBtnTxt, controller.addInstallmentPreset === "custom" && styles.termBtnTxtActive]}>Custom</Text>
                  </Pressable>
                </View>
                {controller.addInstallmentPreset === "custom" ? (
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. 18"
                    placeholderTextColor={T.textMuted}
                    value={controller.addInstallmentMonths}
                    onChangeText={controller.setAddInstallmentMonths}
                    keyboardType="number-pad"
                  />
                ) : null}
              </View>
            </View>
          </ScrollView>

          <Pressable onPress={controller.handleAdd} disabled={controller.saving} style={[styles.saveBtn, controller.saving && styles.disabled]}>
            {controller.saving ? <ActivityIndicator size="small" color={T.onAccent} /> : <Text style={styles.saveBtnTxt}>Add Debt</Text>}
          </Pressable>
        </Animated.View>

        {controller.showAddDueDatePicker ? (
          <View style={styles.dateSheetOverlay}>
            <Pressable style={styles.dateSheetBackdrop} onPress={() => controller.setShowAddDueDatePicker(false)} />
            <View style={styles.dateSheetCard}>
              <View style={styles.dateSheetHeader}>
                <Pressable onPress={() => controller.setShowAddDueDatePicker(false)}>
                  <Text style={styles.dateSheetCancel}>Cancel</Text>
                </Pressable>
                <Text style={styles.dateSheetTitle}>Select due date</Text>
                <Pressable onPress={controller.onConfirmDueDate}>
                  <Text style={styles.dateSheetDone}>Done</Text>
                </Pressable>
              </View>

              <DateTimePicker
                value={controller.addDueDateDraft}
                mode="date"
                display={Platform.OS === "ios" ? "inline" : "calendar"}
                themeVariant={Platform.OS === "ios" ? "dark" : undefined}
                minimumDate={new Date()}
                onChange={controller.onChangeDueDate}
                style={Platform.OS === "ios" ? { height: 340 } : undefined}
              />
            </View>
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </Modal>
  );
}

export default AddDebtSheet;
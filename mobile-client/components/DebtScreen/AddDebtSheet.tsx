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
import NumericInput from "@/components/Shared/NumericInput";
import OverlaySelectInput from "@/components/Shared/OverlaySelectInput";
import { useAppTranslation } from "@/hooks";
import { PAYMENT_SOURCE_OPTIONS, TERM_PRESETS, TYPE_COLORS, TYPE_LABELS } from "@/lib/constants";
import { T } from "@/lib/theme";
import { debtStyles as styles } from "@/components/DebtScreen/style";
import { formatYmdToDmy } from "@/components/DebtScreen/utils";
import type { AddDebtSheetProps } from "@/types";

export function AddDebtSheet({ controller }: AddDebtSheetProps) {
  const { t } = useAppTranslation();
  const debtTypeOptions = Object.keys(TYPE_LABELS).map((type) => ({
    value: type,
    label:
      type === "credit_card"
        ? t("debts.type.creditCard")
        : type === "store_card"
          ? t("debts.type.storeCard")
          : type === "loan"
            ? t("debts.type.loan")
            : type === "mortgage"
              ? t("debts.type.mortgage")
              : type === "hire_purchase"
                ? t("debts.type.hirePurchase")
                : type === "other"
                  ? t("debts.type.other")
                  : TYPE_LABELS[type] ?? type,
    activeColor: TYPE_COLORS[type],
  }));
  const paymentSourceOptions = PAYMENT_SOURCE_OPTIONS.map((option) => ({
    value: option.value,
    label:
      option.value === "income"
        ? t("expenses.funding.income")
        : option.value === "extra_funds"
          ? t("debts.paymentSource.extraFunds")
          : t("debts.paymentSource.card"),
  }));

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
            <Text style={styles.sheetTitle}>{t("debts.add.title")}</Text>
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
                <Text style={styles.termLabel}>{t("debts.add.name")}</Text>
                <TextInput
                  style={styles.input}
                  placeholder={t("debts.add.namePlaceholder")}
                  placeholderTextColor={T.textMuted}
                  value={controller.addName}
                  onChangeText={controller.setAddName}
                  autoFocus
                />
              </View>

              <View style={styles.inlineRow}>
                <View style={[styles.termWrap, { flex: 1 }]}> 
                  <Text style={styles.termLabel}>{controller.isLoanStyleType ? t("debts.add.loanAmount") : t("debts.add.currentBalance")}</Text>
                  <MoneyInput
                    currency={controller.settings?.currency}
                    value={controller.addBalance}
                    onChangeValue={controller.setAddBalance}
                    placeholder="0.00"
                  />
                </View>

                <View style={[styles.termWrap, { flex: 1 }]}> 
                  <Text style={styles.termLabel}>{t("debts.add.type")}</Text>
                  <OverlaySelectInput
                    containerStyle={styles.dropdownAnchor}
                    triggerStyle={styles.input}
                    value={controller.addType}
                    onChange={controller.setAddType}
                    options={debtTypeOptions}
                    placeholder={t("debts.add.selectType")}
                  />
                </View>
              </View>

              <View style={styles.inlineRow}>
                <View style={[styles.termWrap, { flex: 1 }]}> 
                  <Text style={styles.termLabel}>{t("debts.add.dueDateRequired")}</Text>
                  <DatePickerInput
                    containerStyle={styles.input}
                    onPress={() => controller.setShowAddDueDatePicker(true)}
                    value={controller.addDueDate ? formatYmdToDmy(controller.addDueDate) : ""}
                    placeholder={t("debts.add.selectDate")}
                    valueStyle={styles.dateValue}
                    placeholderStyle={styles.dateValuePlaceholder}
                  />
                </View>

                <View style={[styles.termWrap, { flex: 1 }]}> 
                  <Text style={styles.termLabel}>
                    {controller.addInstallmentMonths.trim() ? t("debts.add.monthlyPaymentAuto") : t("debts.add.monthlyPaymentOptional")}
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
                    <Text style={styles.termLabel}>{t("debts.add.creditLimit")}</Text>
                    <MoneyInput
                      currency={controller.settings?.currency}
                      value={controller.addCreditLimit}
                      onChangeValue={controller.setAddCreditLimit}
                      placeholder="0.00"
                    />
                  </View>
                  <View style={[styles.termWrap, { flex: 1 }]}>
                    <Text style={styles.termLabel}>{t("debts.add.interestOptional")}</Text>
                    <NumericInput
                      style={styles.input}
                      placeholder={t("debts.add.interestPlaceholder")}
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
                    <Text style={styles.termLabel}>{t("debts.add.interestOptional")}</Text>
                    <NumericInput
                      style={styles.input}
                      placeholder={t("debts.add.interestPlaceholder")}
                      placeholderTextColor={T.textMuted}
                      value={controller.addInterestRate}
                      onChangeText={controller.setAddInterestRate}
                      keyboardType="decimal-pad"
                    />
                  </View>

                  <View style={[styles.termWrap, { flex: 1 }]}> 
                    <Text style={styles.termLabel}>{t("debts.add.paymentSource")}</Text>
                    <OverlaySelectInput
                      containerStyle={styles.dropdownAnchor}
                      triggerStyle={styles.input}
                      value={controller.addPaymentSource}
                      onChange={controller.onChangePaymentSource}
                      options={paymentSourceOptions}
                      placeholder={t("debts.add.selectSource")}
                    />
                  </View>
                </View>
              )}

              {controller.isCardType ? (
                <View style={styles.termWrap}>
                  <Text style={styles.termLabel}>{t("debts.add.paymentSource")}</Text>
                  <OverlaySelectInput
                    containerStyle={styles.dropdownAnchor}
                    triggerStyle={styles.input}
                    value={controller.addPaymentSource}
                    onChange={controller.onChangePaymentSource}
                    options={paymentSourceOptions}
                    placeholder={t("debts.add.selectSource")}
                  />
                </View>
              ) : null}

              {controller.addPaymentSource === "credit_card" ? (
                <View style={styles.termWrap}>
                  <Text style={styles.termLabel}>{t("debts.add.selectCard")}</Text>
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
                    <Text style={styles.cardChoiceEmpty}>{t("debts.add.noCards")}</Text>
                  )}
                </View>
              ) : null}

              <View style={styles.termWrap}>
                <Text style={styles.termLabel}>{t("debts.add.spreadOverMonths")}</Text>
                <View style={styles.termRow}>
                  <Pressable
                    onPress={controller.onClearInstallments}
                    style={[styles.termBtn, controller.addInstallmentPreset == null && !controller.addInstallmentMonths.trim() && styles.termBtnActive]}
                  >
                    <Text style={[styles.termBtnTxt, controller.addInstallmentPreset == null && !controller.addInstallmentMonths.trim() && styles.termBtnTxtActive]}>{t("common.none")}</Text>
                  </Pressable>
                  {TERM_PRESETS.map((months) => {
                    const active = controller.addInstallmentPreset === months;
                    return (
                      <Pressable
                        key={months}
                        onPress={() => controller.onSelectInstallmentPreset(months)}
                        style={[styles.termBtn, active && styles.termBtnActive]}
                      >
                        <Text style={[styles.termBtnTxt, active && styles.termBtnTxtActive]}>{t("debts.projection.milestoneMonths", { count: months })}</Text>
                      </Pressable>
                    );
                  })}
                  <Pressable
                    onPress={controller.onSelectCustomInstallmentPreset}
                    style={[styles.termBtn, controller.addInstallmentPreset === "custom" && styles.termBtnActive]}
                  >
                    <Text style={[styles.termBtnTxt, controller.addInstallmentPreset === "custom" && styles.termBtnTxtActive]}>{t("common.custom")}</Text>
                  </Pressable>
                </View>
                {controller.addInstallmentPreset === "custom" ? (
                  <NumericInput
                    style={styles.input}
                    placeholder={t("debts.add.customMonthsPlaceholder")}
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
            {controller.saving ? <ActivityIndicator size="small" color={T.onAccent} /> : <Text style={styles.saveBtnTxt}>{t("debts.add.title")}</Text>}
          </Pressable>
        </Animated.View>

        {controller.showAddDueDatePicker ? (
          <View style={styles.dateSheetOverlay}>
            <Pressable style={styles.dateSheetBackdrop} onPress={() => controller.setShowAddDueDatePicker(false)} />
            <View style={styles.dateSheetCard}>
              <View style={styles.dateSheetHeader}>
                <Pressable onPress={() => controller.setShowAddDueDatePicker(false)}>
                  <Text style={styles.dateSheetCancel}>{t("common.cancel")}</Text>
                </Pressable>
                <Text style={styles.dateSheetTitle}>{t("debts.add.selectDueDate")}</Text>
                <Pressable onPress={controller.onConfirmDueDate}>
                  <Text style={styles.dateSheetDone}>{t("common.done")}</Text>
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
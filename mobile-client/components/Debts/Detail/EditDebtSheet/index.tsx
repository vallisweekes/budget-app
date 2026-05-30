import React from "react";
import { Animated, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { EditDebtSheetProps } from "@/types";
import { TERM_PRESETS } from "@/lib/constants";
import { T } from "@/lib/theme";
import { useSwipeDownToClose } from "@/hooks";
import MoneyInput from "@/components/Shared/MoneyInput";
import DatePickerInput from "@/components/Shared/DatePickerInput";
import GlassFooterButton from "@/components/Shared/GlassFooterButton";
import NumericInput from "@/components/Shared/NumericInput";
import { styles } from "./styles";

export default function EditDebtSheet(props: EditDebtSheetProps) {
  const {
    visible, saving, currency, name, currentBalance, interestRate, monthlyPayment, plannedPaymentOverride, plannedPaymentOverridePeriodKey, plannedPaymentOverrideOptions, monthlyMinimum, dueDate, installment, paymentSource, paymentCardDebtId, paymentCards, showDatePicker,
    onClose, onSave, onChangeName, onChangeCurrentBalance, onChangeRate, onChangeMonthlyPayment, onChangeMin,
    onChangePlannedPaymentOverride, onChangePlannedPaymentOverrideTarget, onPickDate, onDateChange, onChangePaymentSource, onChangePaymentCardDebtId, onChangeInstallment, onSetShowDatePicker,
  } = props;

  const insets = useSafeAreaInsets();
  const { dragY, panHandlers } = useSwipeDownToClose({ onClose, disabled: saving });

  const iosDueDateBeforeRef = React.useRef<string>("");
  const [iosDueDateDraft, setIosDueDateDraft] = React.useState<Date>(new Date());
  const [customInstallmentMode, setCustomInstallmentMode] = React.useState(false);
  const [showSourceDropdown, setShowSourceDropdown] = React.useState(false);
  const [showOverridePeriodDropdown, setShowOverridePeriodDropdown] = React.useState(false);

  const closeDropdowns = React.useCallback(() => {
    setShowSourceDropdown(false);
    setShowOverridePeriodDropdown(false);
  }, []);

  const installmentTrim = (installment || "").trim();
  const installmentNum = installmentTrim ? Number.parseInt(installmentTrim, 10) : null;
  const isPresetInstallment = installmentNum != null && TERM_PRESETS.includes(installmentNum as any);

  React.useEffect(() => {
    // If the value is non-empty and not one of our presets, show the custom field.
    if (installmentTrim && !isPresetInstallment) setCustomInstallmentMode(true);
    if (!installmentTrim) setCustomInstallmentMode(false);
  }, [installmentTrim, isPresetInstallment]);

  React.useEffect(() => {
    if (Platform.OS !== "ios") return;
    if (!showDatePicker) return;
    iosDueDateBeforeRef.current = dueDate;
    setIosDueDateDraft(dueDate ? new Date(`${dueDate}T00:00:00`) : new Date());
  }, [showDatePicker, dueDate]);

  React.useEffect(() => {
    if (!visible) {
      closeDropdowns();
    }
  }, [closeDropdowns, visible]);

  const cancelDueDatePicker = React.useCallback(() => {
    onSetShowDatePicker(false);
    if (iosDueDateBeforeRef.current !== dueDate) onDateChange(iosDueDateBeforeRef.current);
  }, [dueDate, onDateChange, onSetShowDatePicker]);

  const closeDueDatePicker = React.useCallback(() => {
    onDateChange(iosDueDateDraft.toISOString().slice(0, 10));
    onSetShowDatePicker(false);
  }, [iosDueDateDraft, onDateChange, onSetShowDatePicker]);

  const selectedOverridePeriodLabel = React.useMemo(() => {
    return plannedPaymentOverrideOptions.find(
      (option) => option.periodKey === plannedPaymentOverridePeriodKey,
    )?.label ?? "Select period";
  }, [plannedPaymentOverrideOptions, plannedPaymentOverridePeriodKey]);

  return (
    <Modal visible={visible} transparent animationType="slide" presentationStyle="overFullScreen" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.sheetOverlay} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <Pressable
          style={styles.sheetBackdrop}
          onPress={() => {
            closeDropdowns();
            onClose();
          }}
        />
        <Animated.View style={[styles.sheetCard, { transform: [{ translateY: dragY }] }]}>
          <View style={styles.sheetHandle} {...panHandlers} />
          <Text style={styles.sectionTitle}>Edit Debt</Text>

          <ScrollView
            style={styles.sheetScroll}
            contentContainerStyle={styles.sheetScrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            scrollEnabled={!showSourceDropdown && !showOverridePeriodDropdown}
            nestedScrollEnabled
          >
            <View style={styles.sectionCard}>
              <Text style={styles.sectionEyebrow}>Overview</Text>

              <View style={styles.formGroup}>
                <Text style={styles.inputLabel}>Name</Text>
                <TextInput style={styles.input} value={name} onChangeText={onChangeName} placeholderTextColor={T.textMuted} />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.inputLabel}>Current balance</Text>
                <MoneyInput
                  currency={currency}
                  value={currentBalance}
                  onChangeValue={onChangeCurrentBalance}
                  placeholder="0.00"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.inputLabel}>APR %</Text>
                <NumericInput style={styles.input} value={interestRate} onChangeText={onChangeRate} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={T.textMuted} />
              </View>
            </View>

            <View style={styles.sectionCard}>
              <Text style={styles.sectionEyebrow}>Payment plan</Text>

              <View style={styles.formRow}>
                <View style={[styles.formGroup, styles.formCol]}>
                  <Text style={styles.inputLabel}>Monthly payment</Text>
                  <MoneyInput
                    currency={currency}
                    value={monthlyPayment}
                    onChangeValue={onChangeMonthlyPayment}
                    placeholder="0.00"
                  />
                  <Text style={styles.helperText}>Recurring amount.</Text>
                </View>

                <View style={[styles.formGroup, styles.formCol]}>
                  <Text style={styles.inputLabel}>Minimum</Text>
                  <MoneyInput
                    currency={currency}
                    value={monthlyMinimum}
                    onChangeValue={onChangeMin}
                    placeholder="0.00"
                  />
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.inputLabel}>Apply to</Text>
                <View style={[styles.dropdownAnchor, showOverridePeriodDropdown && styles.dropdownAnchorActive]}>
                  <Pressable
                    style={styles.input}
                    onPress={() => {
                      setShowSourceDropdown(false);
                      setShowOverridePeriodDropdown((value) => !value);
                    }}
                  >
                    <View style={styles.dropdownValueRow}>
                      <Text style={styles.dateValue}>{selectedOverridePeriodLabel}</Text>
                      <Text style={styles.dropdownChevron}>{showOverridePeriodDropdown ? "▲" : "▼"}</Text>
                    </View>
                  </Pressable>

                  {showOverridePeriodDropdown ? (
                    <ScrollView
                      style={[styles.dropdownMenu, styles.primaryDropdownMenu]}
                      nestedScrollEnabled
                      keyboardShouldPersistTaps="handled"
                      showsVerticalScrollIndicator={false}
                    >
                      {plannedPaymentOverrideOptions.map((option, idx) => {
                        const active = option.periodKey === plannedPaymentOverridePeriodKey;
                        const isLast = idx === plannedPaymentOverrideOptions.length - 1;
                        return (
                          <Pressable
                            key={option.periodKey}
                            onPress={() => {
                              onChangePlannedPaymentOverrideTarget(option.periodKey);
                              closeDropdowns();
                            }}
                            style={[styles.dropdownItem, isLast && styles.dropdownItemLast, active && styles.dropdownItemActive]}
                          >
                            <Text style={[styles.dropdownItemText, active && styles.dropdownItemTextActive]}>{option.label}</Text>
                          </Pressable>
                        );
                      })}
                    </ScrollView>
                  ) : null}
                </View>
                <Text style={styles.helperText}>Choose the due period you want to override.</Text>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.inputLabel}>Custom payment</Text>
                <MoneyInput
                  currency={currency}
                  value={plannedPaymentOverride}
                  onChangeValue={onChangePlannedPaymentOverride}
                  placeholder="Use recurring payment"
                />
                <Text style={styles.helperText}>Leave blank to keep the recurring amount for that period.</Text>
              </View>
            </View>

            <View style={[styles.sectionCard, showOverridePeriodDropdown && styles.sectionCardUnderlay]}>
              <Text style={styles.sectionEyebrow}>Schedule</Text>

              <View style={styles.formRow}>
                <View style={[styles.formGroup, styles.formCol]}>
                  <Text style={styles.inputLabel}>Due date</Text>
                  <DatePickerInput
                    containerStyle={styles.input}
                    onPress={onPickDate}
                    value={dueDate ? dueDate.replace(/^(\d{4})-(\d{2})-(\d{2})$/, "$3/$2/$1") : ""}
                    valueStyle={styles.dateValue}
                    placeholderStyle={styles.dateValuePlaceholder}
                  />
                </View>

                <View style={[styles.formGroup, styles.formCol]}>
                  <Text style={styles.inputLabel}>Payment source</Text>
                  <View style={[styles.dropdownAnchor, showSourceDropdown && styles.dropdownAnchorActive]}>
                    <Pressable
                      style={styles.input}
                      onPress={() => {
                        setShowOverridePeriodDropdown(false);
                        setShowSourceDropdown((v) => !v);
                      }}
                    >
                      <View style={styles.dropdownValueRow}>
                        <Text style={styles.dateValue}>
                          {paymentSource === "income" ? "Income" : paymentSource === "extra_funds" ? "Extra funds" : "Card"}
                        </Text>
                        <Text style={styles.dropdownChevron}>{showSourceDropdown ? "▲" : "▼"}</Text>
                      </View>
                    </Pressable>

                    {showSourceDropdown ? (
                      <ScrollView
                        style={styles.dropdownMenu}
                        nestedScrollEnabled
                        keyboardShouldPersistTaps="handled"
                        showsVerticalScrollIndicator={false}
                      >
                        {[
                          { key: "income", label: "Income" },
                          { key: "extra_funds", label: "Extra funds" },
                          { key: "credit_card", label: "Card" },
                        ].map((opt, idx, arr) => {
                          const active = paymentSource === opt.key;
                          const isLast = idx === arr.length - 1;
                          return (
                            <Pressable
                              key={opt.key}
                              onPress={() => {
                                onChangePaymentSource(opt.key as "income" | "extra_funds" | "credit_card");
                                if (opt.key !== "credit_card") onChangePaymentCardDebtId("");
                                closeDropdowns();
                              }}
                              style={[styles.dropdownItem, isLast && styles.dropdownItemLast, active && styles.dropdownItemActive]}
                            >
                              <Text style={[styles.dropdownItemText, active && styles.dropdownItemTextActive]}>{opt.label}</Text>
                            </Pressable>
                          );
                        })}
                      </ScrollView>
                    ) : null}
                  </View>
                </View>
              </View>
            </View>

            {showDatePicker ? (
              <View style={{ marginBottom: 12 }}>
                {Platform.OS === "android" ? (
                  <DateTimePicker
                    value={dueDate ? new Date(`${dueDate}T00:00:00`) : new Date()}
                    mode="date"
                    display="calendar"
                    minimumDate={new Date()}
                    onChange={(event, selectedDate) => {
                      onSetShowDatePicker(false);
                      if (event.type === "set" && selectedDate) onDateChange(selectedDate.toISOString().slice(0, 10));
                    }}
                  />
                ) : null}
              </View>
            ) : null}

            {Platform.OS === "ios" ? (
              <Modal
                visible={showDatePicker}
                transparent
                animationType="fade"
                presentationStyle="overFullScreen"
                onRequestClose={cancelDueDatePicker}
              >
                <View style={styles.dateModalOverlay}>
                  <Pressable style={styles.dateModalBackdrop} onPress={cancelDueDatePicker} />
                  <View style={styles.dateModalSheet}>
                    <View style={styles.dateModalHeader}>
                      <Pressable onPress={cancelDueDatePicker}>
                        <Text style={styles.dateModalCancelTxt}>Cancel</Text>
                      </Pressable>
                      <Pressable onPress={closeDueDatePicker}>
                        <Text style={styles.dateModalDoneTxt}>Done</Text>
                      </Pressable>
                    </View>
                    <DateTimePicker
                      value={iosDueDateDraft}
                      mode="date"
                      display="inline"
                      themeVariant="dark"
                      minimumDate={new Date()}
                      onChange={(event, selectedDate) => {
                        const next =
                          selectedDate ??
                          // Some iOS inline picker versions only provide a timestamp on the event.
                          (event?.nativeEvent?.timestamp ? new Date(event.nativeEvent.timestamp) : null);
                        if (next) {
                          setIosDueDateDraft(next);
                          onDateChange(next.toISOString().slice(0, 10));
                          onSetShowDatePicker(false);
                        }
                      }}
                      style={{ height: 340 }}
                    />
                  </View>
                </View>
              </Modal>
            ) : null}

            {paymentSource === "credit_card" ? (
              <View style={styles.sectionCard}>
                <Text style={styles.sectionEyebrow}>Funding card</Text>
                <Text style={styles.inputLabel}>Select card</Text>
                {paymentCards.length > 0 ? (
                  <View style={styles.cardPickerWrap}>
                    {paymentCards.map((card) => {
                      const active = paymentCardDebtId === card.id;
                      return (
                        <Pressable
                          key={card.id}
                          onPress={() => onChangePaymentCardDebtId(card.id)}
                          style={[styles.cardPickBtn, active && styles.cardPickBtnActive]}
                        >
                          <Text style={[styles.cardPickTxt, active && styles.cardPickTxtActive]} numberOfLines={1}>
                            {card.name}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                ) : (
                  <Text style={styles.noCardsText}>No cards found. Add a credit/store card first.</Text>
                )}
              </View>
            ) : null}

            <View style={styles.sectionCard}>
              <Text style={styles.sectionEyebrow}>Term</Text>
              <Text style={styles.inputLabel}>Spread over months</Text>
              <View style={styles.installmentRow}>
                {[0, ...TERM_PRESETS].map((months) => {
                  const active = (installment || "0") === String(months);
                  return (
                    <Pressable key={months} onPress={() => onChangeInstallment(months === 0 ? "" : String(months))} style={[styles.installmentChip, active && styles.installmentChipActive]}>
                      <Text style={[styles.installmentChipText, active && styles.installmentChipTextActive]}>{months === 0 ? "None" : `${months} months`}</Text>
                    </Pressable>
                  );
                })}

                <Pressable
                  onPress={() => {
                    setCustomInstallmentMode((v) => {
                      const next = !v;
                      if (!next) onChangeInstallment("");
                      if (next && isPresetInstallment) onChangeInstallment("");
                      return next;
                    });
                  }}
                  style={[styles.installmentChip, customInstallmentMode && styles.installmentChipActive]}
                >
                  <Text style={[styles.installmentChipText, customInstallmentMode && styles.installmentChipTextActive]}>Custom</Text>
                </Pressable>
              </View>

              {customInstallmentMode ? (
                <View style={styles.formGroup}>
                  <Text style={styles.inputLabel}>Custom months</Text>
                  <NumericInput
                    style={styles.input}
                    value={installment}
                    onChangeText={onChangeInstallment}
                    keyboardType="number-pad"
                    placeholder="e.g. 18"
                    placeholderTextColor={T.textMuted}
                  />
                </View>
              ) : null}
            </View>
          </ScrollView>

          <View style={[styles.bottomActions, { paddingBottom: insets.bottom + 24 }]}> 
            <View style={styles.sheetActions}>
              <GlassFooterButton
                label="Cancel"
                onPress={onClose}
                disabled={saving}
                variant="dark"
                tone="light"
                containerStyle={styles.actionBtn}
              />
              <GlassFooterButton
                label="Save Changes"
                onPress={onSave}
                disabled={saving}
                loading={saving}
                variant="light"
                tone="dark"
                containerStyle={styles.actionBtn}
              />
            </View>
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

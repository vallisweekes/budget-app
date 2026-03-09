import React from "react";
import { ActivityIndicator, Animated, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";

import type { EditDebtSheetProps } from "@/types";
import { TERM_PRESETS } from "@/lib/constants";
import { T } from "@/lib/theme";
import { useSwipeDownToClose } from "@/hooks";
import MoneyInput from "@/components/Shared/MoneyInput";
import DatePickerInput from "@/components/Shared/DatePickerInput";
import { styles } from "./styles";

export default function EditDebtSheet(props: EditDebtSheetProps) {
  const {
    visible, saving, currency, name, currentBalance, interestRate, monthlyPayment, monthlyMinimum, dueDate, installment, paymentSource, paymentCardDebtId, paymentCards, showDatePicker,
    onClose, onSave, onChangeName, onChangeCurrentBalance, onChangeRate, onChangeMonthlyPayment, onChangeMin,
    onPickDate, onDateChange, onChangePaymentSource, onChangePaymentCardDebtId, onChangeInstallment, onSetShowDatePicker,
  } = props;

  const { dragY, panHandlers } = useSwipeDownToClose({ onClose, disabled: saving });

  const iosDueDateBeforeRef = React.useRef<string>("");
  const [iosDueDateDraft, setIosDueDateDraft] = React.useState<Date>(new Date());
  const [customInstallmentMode, setCustomInstallmentMode] = React.useState(false);
  const [showSourceDropdown, setShowSourceDropdown] = React.useState(false);

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

  const cancelDueDatePicker = React.useCallback(() => {
    onSetShowDatePicker(false);
    if (iosDueDateBeforeRef.current !== dueDate) onDateChange(iosDueDateBeforeRef.current);
  }, [dueDate, onDateChange, onSetShowDatePicker]);

  const closeDueDatePicker = React.useCallback(() => {
    onDateChange(iosDueDateDraft.toISOString().slice(0, 10));
    onSetShowDatePicker(false);
  }, [iosDueDateDraft, onDateChange, onSetShowDatePicker]);

  return (
    <Modal visible={visible} transparent animationType="slide" presentationStyle="overFullScreen" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.sheetOverlay} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <Pressable style={styles.sheetBackdrop} onPress={onClose} />
        <Animated.View style={[styles.sheetCard, { transform: [{ translateY: dragY }] }]}>
          <View style={styles.sheetHandle} {...panHandlers} />
          <Text style={styles.sectionTitle}>Edit Debt</Text>

          <ScrollView style={styles.sheetScroll} contentContainerStyle={styles.sheetScrollContent} showsVerticalScrollIndicator={false}>
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
              <Text style={styles.inputLabel}>Interest Rate % (optional)</Text>
              <TextInput style={styles.input} value={interestRate} onChangeText={onChangeRate} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={T.textMuted} />
            </View>

            <View style={styles.formRow}>
              <View style={[styles.formGroup, styles.formCol]}>
                <Text style={styles.inputLabel}>Monthly payment</Text>
                <MoneyInput
                  currency={currency}
                  value={monthlyPayment}
                  onChangeValue={onChangeMonthlyPayment}
                  placeholder="0.00"
                />
              </View>

              <View style={[styles.formGroup, styles.formCol]}>
                <Text style={styles.inputLabel}>Monthly minimum</Text>
                <MoneyInput
                  currency={currency}
                  value={monthlyMinimum}
                  onChangeValue={onChangeMin}
                  placeholder="0.00"
                />
              </View>
            </View>

            <View style={styles.formRow}>
              <View style={[styles.formGroup, styles.formCol]}>
                <Text style={styles.inputLabel}>Due date (calendar)</Text>
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
                <View style={styles.dropdownAnchor}>
                  <Pressable style={styles.input} onPress={() => setShowSourceDropdown((v) => !v)}>
                    <View style={styles.dropdownValueRow}>
                      <Text style={styles.dateValue}>
                        {paymentSource === "income" ? "Income" : paymentSource === "extra_funds" ? "Extra funds" : "Card"}
                      </Text>
                      <Text style={styles.dropdownChevron}>{showSourceDropdown ? "▲" : "▼"}</Text>
                    </View>
                  </Pressable>

                  {showSourceDropdown ? (
                    <View style={styles.dropdownMenu}>
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
                              setShowSourceDropdown(false);
                            }}
                            style={[styles.dropdownItem, isLast && styles.dropdownItemLast, active && styles.dropdownItemActive]}
                          >
                            <Text style={[styles.dropdownItemText, active && styles.dropdownItemTextActive]}>{opt.label}</Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  ) : null}
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
              <View style={styles.formGroup}>
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
                <TextInput
                  style={styles.input}
                  value={installment}
                  onChangeText={onChangeInstallment}
                  keyboardType="number-pad"
                  placeholder="e.g. 18"
                  placeholderTextColor={T.textMuted}
                />
              </View>
            ) : null}
          </ScrollView>

          <View style={styles.sheetActions}>
            <Pressable onPress={onClose} style={[styles.cancelBtn, saving && styles.disabled]}><Text style={styles.cancelBtnTxt}>Cancel</Text></Pressable>
            <Pressable onPress={onSave} disabled={saving} style={[styles.saveBtn, styles.saveBtnFlex, saving && styles.disabled]}>
              {saving ? <ActivityIndicator size="small" color={T.onAccent} /> : <Text style={styles.saveBtnTxt}>Save Changes</Text>}
            </Pressable>
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

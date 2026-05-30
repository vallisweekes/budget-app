import React, { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { Modal, Platform, Pressable, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";

import type {
  ExpenseCategoryBreakdown,
  ExpenseSuggestion,
} from "@/lib/apiTypes";
import type { ExpenseFundingOption } from "@/lib/domain/expenseFunding";
import { useAppTranslation } from "@/hooks";
import { T } from "@/lib/theme";
import MoneyInput from "@/components/Shared/MoneyInput";
import DatePickerInput from "@/components/Shared/DatePickerInput";

import AddExpenseCategoryRow from "@/components/Expenses/AddExpenseCategoryRow";
import { styles, pr } from "@/components/Expenses/AddExpenseSheet/styles";

const s = styles;

/** Format a YYYY-MM-DD string to DD/MM/YYYY for display */
function isoToDMY(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return "";
  return `${m[3]}/${m[2]}/${m[1]}`;
}

function parseDateOnly(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value ?? "").trim());
  if (!match) return null;
  const next = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  next.setHours(0, 0, 0, 0);
  return Number.isFinite(next.getTime()) ? next : null;
}

function formatDateOnly(value: Date): string {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

function clampDateToRange(value: Date, minimumDate: Date, maximumDate: Date): Date {
  const next = new Date(value);
  next.setHours(0, 0, 0, 0);
  if (next.getTime() < minimumDate.getTime()) return minimumDate;
  if (next.getTime() > maximumDate.getTime()) return maximumDate;
  return next;
}

export default function AddExpenseSheetFields({
  name,
  setName,
  amount,
  setAmount,
  categoryId,
  setCategoryId,
  dueDate,
  setDueDate,
  fundingOptions,
  selectedFundingKey,
  selectedFundingLabel,
  onSelectFundingOption,
  categories,
  currency,
  minimumDate,
  maximumDate,
  fallbackDate,
  suggestions,
  suggestionsLoading,
  onPickSuggestion,
}: {
  name: string;
  setName: (v: string) => void;
  amount: string;
  setAmount: (v: string) => void;
  categoryId: string;
  setCategoryId: (v: string) => void;
  dueDate: string;
  setDueDate: (v: string) => void;
  fundingOptions: ExpenseFundingOption[];
  selectedFundingKey: string;
  selectedFundingLabel: string;
  onSelectFundingOption: (option: ExpenseFundingOption) => void;
  categories: ExpenseCategoryBreakdown[];
  currency: string;
  minimumDate: Date;
  maximumDate: Date;
  fallbackDate: Date;
  suggestions: ExpenseSuggestion[];
  suggestionsLoading: boolean;
  onPickSuggestion: (s: ExpenseSuggestion) => void;
}) {
  const { t } = useAppTranslation();
  const [showPicker, setShowPicker] = useState(false);
  const [showSourceDropdown, setShowSourceDropdown] = useState(false);
  // iOS: hold a draft while the spinner is open
  const [iosDraft, setIosDraft] = useState<Date>(fallbackDate);
  const iosBeforeRef = useRef("");

  const dueDateObj = useMemo(
    () => clampDateToRange(parseDateOnly(dueDate) ?? fallbackDate, minimumDate, maximumDate),
    [dueDate, fallbackDate, maximumDate, minimumDate],
  );

  useEffect(() => {
    if (!dueDate) return;
    const parsed = parseDateOnly(dueDate);
    if (!parsed) {
      setDueDate("");
      return;
    }
    if (parsed.getTime() < minimumDate.getTime() || parsed.getTime() > maximumDate.getTime()) {
      setDueDate("");
    }
  }, [dueDate, maximumDate, minimumDate, setDueDate]);

  const openPicker = useCallback(() => {
    if (Platform.OS === "ios") {
      iosBeforeRef.current = dueDate;
      setIosDraft(clampDateToRange(parseDateOnly(dueDate) ?? fallbackDate, minimumDate, maximumDate));
    }
    setShowPicker(true);
  }, [dueDate, fallbackDate, maximumDate, minimumDate]);

  const cancelPicker = useCallback(() => {
    if (Platform.OS === "ios") {
      setDueDate(iosBeforeRef.current);
    }
    setShowPicker(false);
  }, [setDueDate]);

  const confirmPicker = useCallback(() => {
    if (Platform.OS === "ios") {
      setDueDate(formatDateOnly(iosDraft));
    }
    setShowPicker(false);
  }, [iosDraft, setDueDate]);

  return (
    <View style={styles.formScroll}>
      <View style={styles.fieldGroup}>
        <Text style={styles.label}>{t("expenses.fieldName")}</Text>
        <TextInput
          style={s.input}
          value={name}
          onChangeText={setName}
          placeholder={t("expenses.fieldNamePlaceholder")}
          placeholderTextColor={T.textMuted}
          selectionColor={T.accent}
          returnKeyType="next"
          autoCapitalize="words"
        />

        {Boolean(categoryId) && suggestionsLoading && (
          <Text style={{ color: T.textMuted, fontSize: 12, fontWeight: "600" }}>
            {t("expenses.loadingPreviousExpenses")}
          </Text>
        )}

        {Boolean(categoryId) && !suggestionsLoading && Array.isArray(suggestions) && suggestions.length > 0 && (
          <View style={{ gap: 8 }}>
            <Text style={[s.label, { marginTop: 2 }]}>{t("expenses.previousInCategory")}</Text>
            <View
              style={{
                backgroundColor: T.cardAlt,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: T.border,
                overflow: "hidden",
              }}
            >
              {suggestions.slice(0, 6).map((sug, idx) => {
                const amountNum = Number.parseFloat(String(sug.amount));
                const amountText = Number.isFinite(amountNum)
                  ? `${currency}${amountNum.toFixed(2)}`
                  : `${currency}${sug.amount}`;

                return (
                  <TouchableOpacity
                    key={sug.seriesKey}
                    onPress={() => onPickSuggestion(sug)}
                    activeOpacity={0.75}
                    style={{
                      paddingHorizontal: 14,
                      paddingVertical: 12,
                      borderTopWidth: idx === 0 ? 0 : 1,
                      borderTopColor: T.border,
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 10,
                    }}
                  >
                    <Text style={{ color: T.text, fontSize: 14, fontWeight: "800", flex: 1 }} numberOfLines={1}>
                      {sug.name}
                    </Text>
                    <Text style={{ color: T.textMuted, fontSize: 12, fontWeight: "800" }}>
                      {amountText}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}
      </View>

      <View style={s.halfRow}>
        <View style={[s.fieldGroup, s.halfCol]}>
          <Text style={s.label}>{t("expenses.fieldAmount", { currency })}</Text>
          <MoneyInput
            currency={currency}
            value={amount}
            onChangeValue={setAmount}
            placeholder="0.00"
            selectionColor={T.accent}
            returnKeyType="done"
          />
        </View>

        <View style={[s.fieldGroup, s.halfCol]}>
          <Text style={s.label}>
            {t("expenses.fieldDueDate")} <Text style={s.optional}>({t("expenses.optional")})</Text>
          </Text>

          <DatePickerInput
            containerStyle={s.input}
            onPress={openPicker}
            value={dueDate ? isoToDMY(dueDate) : ""}
            placeholder={t("expenses.datePlaceholder")}
          />
        </View>
      </View>

      <View style={s.fieldGroup}>
        <Text style={s.label}>{t("expenses.fieldCategory")}</Text>
        <AddExpenseCategoryRow categories={categories} value={categoryId} onChange={setCategoryId} />
      </View>

      {/* ── Source of Funds ── */}
      <View style={s.fieldGroup}>
        <Text style={s.label}>{t("expenses.fieldFundingSource")}</Text>
        <View style={{ position: "relative", zIndex: 30 }}>
          <Pressable
            style={[s.input, showSourceDropdown && s.selectInputOpen]}
            onPress={() => setShowSourceDropdown((open) => !open)}
          >
            <View style={s.selectRow}>
              <Text style={s.selectValueText}>{selectedFundingLabel}</Text>
              <Ionicons name={showSourceDropdown ? "chevron-up" : "chevron-down"} size={16} color={T.textDim} />
            </View>
          </Pressable>

          {showSourceDropdown ? (
            <View style={s.dropdownMenu}>
              <ScrollView style={{ maxHeight: 260 }} nestedScrollEnabled>
                {fundingOptions.map((option, idx) => {
                  const active = selectedFundingKey === option.key;
                  return (
                    <Pressable
                      key={option.key}
                      onPress={() => {
                        onSelectFundingOption(option);
                        setShowSourceDropdown(false);
                      }}
                      style={[
                        s.dropdownOption,
                        idx === fundingOptions.length - 1 && s.dropdownOptionLast,
                        active && s.dropdownOptionActive,
                      ]}
                    >
                      <Text style={[s.dropdownOptionText, active && s.dropdownOptionTextActive]}>
                        {option.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          ) : null}
        </View>
      </View>

      {/* Android: inline picker */}
      {showPicker && Platform.OS === "android" && (
        <DateTimePicker
          value={dueDateObj}
          mode="date"
          display="calendar"
          minimumDate={minimumDate}
          maximumDate={maximumDate}
          onChange={(event, selected) => {
            setShowPicker(false);
            if (event.type === "set" && selected) {
              setDueDate(formatDateOnly(clampDateToRange(selected, minimumDate, maximumDate)));
            }
          }}
        />
      )}

      {/* iOS: modal spinner with Cancel / Done */}
      {Platform.OS === "ios" && (
        <Modal
          visible={showPicker}
          transparent
          animationType="fade"
          presentationStyle="overFullScreen"
          onRequestClose={cancelPicker}
        >
          <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.45)" }}>
            <Pressable style={{ flex: 1 }} onPress={cancelPicker} />
            <View style={s.dateModalSheet}>
              <View style={s.dateModalHeader}>
                <TouchableOpacity onPress={cancelPicker} hitSlop={10}>
                  <Text style={s.dateModalActionMuted}>{t("common.cancel")}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={confirmPicker} hitSlop={10}>
                  <Text style={s.dateModalActionPrimary}>{t("common.done")}</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={iosDraft}
                mode="date"
                display="inline"
                themeVariant="dark"
                minimumDate={minimumDate}
                maximumDate={maximumDate}
                onChange={(event, selected) => {
                  const next =
                    selected ??
                    // Some iOS inline picker versions only provide a timestamp on the event.
                    (event?.nativeEvent?.timestamp ? new Date(event.nativeEvent.timestamp) : null);
                  if (next) {
                    setIosDraft(clampDateToRange(next, minimumDate, maximumDate));
                  }
                }}
                style={{ height: 340 }}
              />
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

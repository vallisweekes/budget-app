import React, { useState, useCallback, useRef } from "react";
import { Modal, Platform, Pressable, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";

import type { CreditCard, ExpenseCategoryBreakdown, ExpensePaymentSource } from "@/lib/apiTypes";
import { T } from "@/lib/theme";

import AddExpenseCategoryRow from "@/components/Expenses/AddExpenseCategoryRow";
import { s, pr } from "@/components/Expenses/AddExpenseSheet.styles";

/** Format a YYYY-MM-DD string to DD/MM/YYYY for display */
function isoToDMY(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return "";
  return `${m[3]}/${m[2]}/${m[1]}`;
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
  paymentSource,
  setPaymentSource,
  cardDebtId,
  setCardDebtId,
  cards,
  categories,
  currency,
}: {
  name: string;
  setName: (v: string) => void;
  amount: string;
  setAmount: (v: string) => void;
  categoryId: string;
  setCategoryId: (v: string) => void;
  dueDate: string;
  setDueDate: (v: string) => void;
  paymentSource: ExpensePaymentSource;
  setPaymentSource: (v: ExpensePaymentSource) => void;
  cardDebtId: string;
  setCardDebtId: (v: string) => void;
  cards: CreditCard[];
  categories: ExpenseCategoryBreakdown[];
  currency: string;
}) {
  const [showPicker, setShowPicker] = useState(false);
  // iOS: hold a draft while the spinner is open
  const [iosDraft, setIosDraft] = useState<Date>(new Date());
  const iosBeforeRef = useRef("");

  const dueDateObj = dueDate ? new Date(`${dueDate}T00:00:00`) : new Date();

  const openPicker = useCallback(() => {
    if (Platform.OS === "ios") {
      iosBeforeRef.current = dueDate;
      setIosDraft(dueDate ? new Date(`${dueDate}T00:00:00`) : new Date());
    }
    setShowPicker(true);
  }, [dueDate]);

  const cancelPicker = useCallback(() => {
    if (Platform.OS === "ios") {
      setDueDate(iosBeforeRef.current);
    }
    setShowPicker(false);
  }, [setDueDate]);

  const confirmPicker = useCallback(() => {
    if (Platform.OS === "ios") {
      setDueDate(iosDraft.toISOString().slice(0, 10));
    }
    setShowPicker(false);
  }, [iosDraft, setDueDate]);

  return (
    <View style={s.formScroll}>
      <View style={s.fieldGroup}>
        <Text style={s.label}>Expense name</Text>
        <TextInput
          style={s.input}
          value={name}
          onChangeText={setName}
          placeholder="e.g. Netflix, Rent…"
          placeholderTextColor={T.textMuted}
          selectionColor={T.accent}
          returnKeyType="next"
          autoCapitalize="words"
        />
      </View>

      <View style={s.halfRow}>
        <View style={[s.fieldGroup, s.halfCol]}>
          <Text style={s.label}>Amount ({currency})</Text>
          <TextInput
            style={s.input}
            value={amount}
            onChangeText={setAmount}
            placeholder="0.00"
            placeholderTextColor={T.textMuted}
            selectionColor={T.accent}
            keyboardType="decimal-pad"
            returnKeyType="done"
          />
        </View>

        <View style={[s.fieldGroup, s.halfCol]}>
          <Text style={s.label}>
            Due date <Text style={s.optional}>(optional)</Text>
          </Text>

          <TouchableOpacity style={s.input} onPress={openPicker} activeOpacity={0.7}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Text style={dueDate ? { color: T.text, fontSize: 15, fontWeight: "700" } : { color: T.textMuted, fontSize: 15, fontWeight: "700" }}>
                {dueDate ? isoToDMY(dueDate) : "DD/MM/YYYY"}
              </Text>
              <Ionicons name="calendar-outline" size={18} color={T.accent} />
            </View>
          </TouchableOpacity>
        </View>
      </View>

      <View style={s.fieldGroup}>
        <Text style={s.label}>Category</Text>
        <AddExpenseCategoryRow categories={categories} value={categoryId} onChange={setCategoryId} />
      </View>

      {/* ── Source of Funds ── */}
      <View style={s.fieldGroup}>
        <Text style={s.label}>Source of funds</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={pr.row}>
          {(
            [
              { value: "income",      label: "Income" },
              { value: "credit_card", label: "Credit Card" },
              { value: "savings",     label: "Savings" },
              { value: "other",       label: "Other" },
            ] as { value: ExpensePaymentSource; label: string }[]
          ).map((opt) => {
            const active = paymentSource === opt.value;
            return (
              <TouchableOpacity
                key={opt.value}
                onPress={() => {
                  setPaymentSource(opt.value);
                  if (opt.value !== "credit_card") setCardDebtId("");
                }}
                style={[pr.pill, active && pr.pillSelected]}
                activeOpacity={0.75}
              >
                <Text style={[pr.pillTxt, active && pr.pillTxtSelected]}>{opt.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Card picker — shown only when credit_card is selected and >1 card */}
        {paymentSource === "credit_card" && cards.length > 1 && (
          <View style={{ gap: 6, marginTop: 6 }}>
            <Text style={[s.label, { marginBottom: 0 }]}>Which card?</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={pr.row}>
              {cards.map((card) => {
                const active = cardDebtId === card.id;
                return (
                  <TouchableOpacity
                    key={card.id}
                    onPress={() => setCardDebtId(card.id)}
                    style={[pr.pill, active && pr.pillSelected]}
                    activeOpacity={0.75}
                  >
                    <Text style={[pr.pillTxt, active && pr.pillTxtSelected]}>{card.name}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {paymentSource === "credit_card" && cards.length === 0 && (
          <View style={{ backgroundColor: "#f59e0b18", borderRadius: 10, padding: 10, marginTop: 4, borderWidth: 1, borderColor: "#f59e0b44" }}>
            <Text style={{ color: "#f59e0b", fontSize: 12, fontWeight: "700" }}>
              No credit cards found. Add one in Debts first.
            </Text>
          </View>
        )}
      </View>

      {/* Android: inline picker */}
      {showPicker && Platform.OS === "android" && (
        <DateTimePicker
          value={dueDateObj}
          mode="date"
          display="calendar"
          onChange={(event, selected) => {
            setShowPicker(false);
            if (event.type === "set" && selected) {
              setDueDate(selected.toISOString().slice(0, 10));
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
            <View style={{ backgroundColor: T.card, borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingBottom: 24 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: T.border }}>
                <TouchableOpacity onPress={cancelPicker} hitSlop={10}>
                  <Text style={{ color: T.textMuted, fontSize: 16, fontWeight: "600" }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={confirmPicker} hitSlop={10}>
                  <Text style={{ color: T.accent, fontSize: 16, fontWeight: "700" }}>Done</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={iosDraft}
                mode="date"
                display="inline"
                themeVariant="dark"
                onChange={(_, selected) => {
                  if (selected) setIosDraft(selected);
                }}
                style={{ height: 200 }}
              />
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

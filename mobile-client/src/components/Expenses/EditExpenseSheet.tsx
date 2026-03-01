import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { apiFetch } from "@/lib/api";
import type { Category, Expense, ExpenseCategoryBreakdown } from "@/lib/apiTypes";
import { resolveCategoryColor } from "@/lib/categoryColors";
import { T } from "@/lib/theme";
import { ADD_EXPENSE_SHEET_SCREEN_H, pr, s } from "@/components/Expenses/AddExpenseSheet.styles";
import { useSwipeDownToClose } from "@/lib/hooks/useSwipeDownToClose";

const { height: SCREEN_H } = Dimensions.get("window");

const IOS_INLINE_CALENDAR_H = Math.min(380, Math.max(320, Math.round(SCREEN_H * 0.46)));

function isoToDMY(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return "";
  return `${m[3]}/${m[2]}/${m[1]}`;
}

function toBreakdowns(categories: Category[]): ExpenseCategoryBreakdown[] {
  return categories.map((c) => ({
    categoryId: c.id,
    name: c.name,
    color: c.color,
    icon: c.icon,
    total: 0,
    paidTotal: 0,
    paidCount: 0,
    totalCount: 0,
  }));
}

function CategoryChipsRow({
  categories,
  value,
  onChange,
}: {
  categories: ExpenseCategoryBreakdown[];
  value: string;
  onChange: (id: string) => void;
}) {
  const scrollRef = useRef<ScrollView>(null);
  const layoutsRef = useRef<Record<string, { x: number; width: number }>>({});
  const [containerWidth, setContainerWidth] = useState(0);
  const [contentWidth, setContentWidth] = useState(0);

  useEffect(() => {
    layoutsRef.current = {};
  }, [categories]);

  useEffect(() => {
    if (!value) return;
    if (!containerWidth) return;
    const layout = layoutsRef.current[value];
    if (!layout) return;

    const centerX = layout.x + layout.width / 2;
    const desiredX = centerX - containerWidth / 2;
    const maxX = Math.max(0, contentWidth - containerWidth);
    const nextX = Math.max(0, Math.min(desiredX, maxX));

    const raf = requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ x: nextX, animated: true });
    });
    return () => cancelAnimationFrame(raf);
  }, [containerWidth, contentWidth, value]);

  return (
    <ScrollView
      ref={scrollRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={pr.row}
      keyboardShouldPersistTaps="handled"
      onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
      onContentSizeChange={(w) => setContentWidth(w)}
    >
      {categories.map((c) => {
        const active = value === c.categoryId;
        const color = resolveCategoryColor(c.color);
        return (
          <Pressable
            key={c.categoryId}
            style={[pr.pill, active && { borderColor: color, backgroundColor: `${color}22` }]}
            onPress={() => onChange(c.categoryId)}
            onLayout={(e) => {
              const layout = {
                x: e.nativeEvent.layout.x,
                width: e.nativeEvent.layout.width,
              };
              layoutsRef.current[c.categoryId] = layout;

              // If this is the selected category, scroll immediately (ensures
              // the first open centers correctly once layouts are available).
              if (c.categoryId === value && containerWidth) {
                const centerX = layout.x + layout.width / 2;
                const desiredX = centerX - containerWidth / 2;
                const maxX = Math.max(0, contentWidth - containerWidth);
                const nextX = Math.max(0, Math.min(desiredX, maxX));
                requestAnimationFrame(() => {
                  scrollRef.current?.scrollTo({ x: nextX, animated: true });
                });
              }
            }}
          >
            <View style={[pr.dot, { backgroundColor: color }]} />
            <Text style={[pr.pillTxt, active && { color: color, fontWeight: "900" }]} numberOfLines={1}>
              {c.name}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export default function EditExpenseSheet({
  visible,
  expense,
  budgetPlanId,
  currency,
  onSaved,
  onClose,
}: {
  visible: boolean;
  expense: Expense | null;
  budgetPlanId?: string | null;
  currency: string;
  onSaved: () => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const slideY = useRef(new Animated.Value(ADD_EXPENSE_SHEET_SCREEN_H ?? SCREEN_H)).current;

  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [isAllocation, setIsAllocation] = useState(false);
  const [isDirectDebit, setIsDirectDebit] = useState(false);
  const [distributeMonths, setDistributeMonths] = useState(false);
  const [distributeYears, setDistributeYears] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { dragY, panHandlers } = useSwipeDownToClose({ onClose, disabled: submitting });

  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  const [categories, setCategories] = useState<ExpenseCategoryBreakdown[]>([]);

  // Due date picker
  const [showPicker, setShowPicker] = useState(false);
  const [iosDraft, setIosDraft] = useState<Date>(new Date());
  const dueDateObj = useMemo(() => (dueDate ? new Date(`${dueDate}T00:00:00`) : new Date()), [dueDate]);

  useEffect(() => {
    Animated.spring(slideY, {
      toValue: visible ? 0 : SCREEN_H,
      useNativeDriver: true,
      bounciness: 3,
      speed: 18,
    }).start();

    if (visible && expense) {
      setName(String(expense.name ?? ""));
      setAmount(String(expense.amount ?? ""));
      setCategoryId(String(expense.categoryId ?? ""));
      setDueDate(expense.dueDate ? String(expense.dueDate).slice(0, 10) : "");
      setIsAllocation(Boolean(expense.isAllocation));
      setIsDirectDebit(Boolean(expense.isDirectDebit));
      setDistributeMonths(false);
      setDistributeYears(false);
      setSubmitting(false);
      setError(null);
      setShowPicker(false);
      setIosDraft(expense.dueDate ? new Date(`${String(expense.dueDate).slice(0, 10)}T00:00:00`) : new Date());
    }

    if (!visible) {
      setTimeout(() => {
        setSubmitting(false);
        setError(null);
        setShowPicker(false);
        setDistributeMonths(false);
        setDistributeYears(false);
      }, 250);
    }
  }, [expense, slideY, visible]);

  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const subShow = Keyboard.addListener(showEvent, (e) => {
      setKeyboardVisible(true);
      setKeyboardHeight(e?.endCoordinates?.height ?? 0);
    });
    const subHide = Keyboard.addListener(hideEvent, () => {
      setKeyboardVisible(false);
      setKeyboardHeight(0);
    });

    return () => {
      subShow.remove();
      subHide.remove();
    };
  }, []);

  useEffect(() => {
    if (!visible) return;
    void (async () => {
      try {
        const qp = budgetPlanId ? `?budgetPlanId=${encodeURIComponent(budgetPlanId)}` : "";
        const data = await apiFetch<Category[]>(`/api/bff/categories${qp}`);
        setCategories(Array.isArray(data) ? toBreakdowns(data) : []);
      } catch {
        setCategories([]);
      }
    })();
  }, [budgetPlanId, visible]);

  const parsedAmount = useMemo(() => {
    const n = Number.parseFloat(String(amount ?? "").replace(/,/g, ""));
    return Number.isFinite(n) ? n : NaN;
  }, [amount]);

  const canSubmit = Boolean(expense) && name.trim().length > 0 && Number.isFinite(parsedAmount) && parsedAmount >= 0 && categoryId.trim().length > 0;

  const openPicker = () => {
    if (Platform.OS === "ios") {
      setIosDraft(dueDate ? new Date(`${dueDate}T00:00:00`) : new Date());
    }
    setShowPicker(true);
  };

  const cancelPicker = () => {
    setShowPicker(false);
  };

  const confirmPicker = () => {
    if (Platform.OS === "ios") {
      setDueDate(iosDraft.toISOString().slice(0, 10));
    }
    setShowPicker(false);
  };

  const clearPicker = () => {
    setDueDate("");
    setShowPicker(false);
  };

  const handleSubmit = async () => {
    if (!expense || !canSubmit || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await apiFetch(`/api/bff/expenses/${expense.id}`, {
        method: "PATCH",
        body: {
          name: name.trim(),
          amount: parsedAmount,
          categoryId,
          dueDate: dueDate.trim() ? dueDate.trim() : "",
          isAllocation,
          isDirectDebit,
          distributeMonths,
          distributeYears,
        },
      });
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save changes. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      presentationStyle="overFullScreen"
      onRequestClose={() => {
        if (submitting) return;
        onClose();
      }}
    >
      <View style={s.overlay}>
        <Pressable
          style={s.backdrop}
          onPress={() => {
            if (submitting) return;
            onClose();
          }}
        />

        <Animated.View style={[s.sheet, { transform: [{ translateY: Animated.add(slideY, dragY) }] }]}>
          <View style={s.handle} {...panHandlers} />

          <View style={s.header} {...panHandlers}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={s.title}>Edit expense</Text>
              <Text style={s.sub}>Update details and save</Text>
            </View>

            <Pressable
              style={s.closeBtn}
              onPress={() => {
                if (submitting) return;
                onClose();
              }}
              hitSlop={10}
            >
              <Ionicons name="close" size={18} color={T.text} />
            </Pressable>
          </View>

          <View style={{ flex: 1 }}>
            <ScrollView
              style={{ flex: 1 }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 8 }}
            >
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
                    editable={!submitting}
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
                      keyboardType={Platform.OS === "ios" ? "decimal-pad" : "numeric"}
                      inputMode="decimal"
                      editable={!submitting}
                    />
                  </View>

                  <View style={[s.fieldGroup, s.halfCol]}>
                    <Text style={s.label}>
                      Due date <Text style={s.optional}>(optional)</Text>
                    </Text>

                    <TouchableOpacity style={s.input} onPress={openPicker} activeOpacity={0.7} disabled={submitting}>
                      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                        <Text
                          style={
                            dueDate
                              ? { color: T.text, fontSize: 15, fontWeight: "700" }
                              : { color: T.textMuted, fontSize: 15, fontWeight: "700" }
                          }
                        >
                          {dueDate ? isoToDMY(dueDate) : "DD/MM/YYYY"}
                        </Text>
                        <Ionicons name="calendar-outline" size={18} color={T.accent} />
                      </View>
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={s.fieldGroup}>
                  <Text style={s.label}>Category</Text>
                  <CategoryChipsRow categories={categories} value={categoryId} onChange={setCategoryId} />
                </View>

                <View style={{ gap: 18 }}>
                  <View style={s.toggleRow}>
                    <View style={s.toggleInfo}>
                      <Text style={s.toggleTitle}>Allocation payment</Text>
                      <Text style={s.toggleSub}>For envelopes like groceries — never becomes a debt</Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => setIsAllocation((v) => !v)}
                      style={[s.toggle, isAllocation && s.toggleOn]}
                      activeOpacity={0.8}
                      disabled={submitting}
                    >
                      <View style={[s.toggleThumb, isAllocation && s.toggleThumbOn]} />
                    </TouchableOpacity>
                  </View>

                  <View style={s.toggleRow}>
                    <View style={s.toggleInfo}>
                      <Text style={s.toggleTitle}>Direct Debit / Standing Order</Text>
                      <Text style={s.toggleSub}>Automatically collected each month</Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => setIsDirectDebit((v) => !v)}
                      style={[s.toggle, isDirectDebit && s.toggleOn]}
                      activeOpacity={0.8}
                      disabled={submitting}
                    >
                      <View style={[s.toggleThumb, isDirectDebit && s.toggleThumbOn]} />
                    </TouchableOpacity>
                  </View>

                  <View style={s.toggleRow}>
                    <View style={s.toggleInfo}>
                      <Text style={s.toggleTitle}>Distribute remaining months</Text>
                      <Text style={s.toggleSub}>Add to every month from now through December</Text>
                    </View>
                    <TouchableOpacity
                      onPress={() =>
                        setDistributeMonths((v) => {
                          const next = !v;
                          // Turning months off must also turn years off
                          if (!next) setDistributeYears(() => false);
                          return next;
                        })
                      }
                      style={[s.toggle, distributeMonths && s.toggleOn]}
                      activeOpacity={0.8}
                      disabled={submitting}
                    >
                      <View style={[s.toggleThumb, distributeMonths && s.toggleThumbOn]} />
                    </TouchableOpacity>
                  </View>

                  <View style={s.toggleRow}>
                    <View style={s.toggleInfo}>
                      <Text style={s.toggleTitle}>Distribute across all years</Text>
                      <Text style={s.toggleSub}>Repeat for every year remaining in the budget horizon</Text>
                    </View>
                    <TouchableOpacity
                      onPress={() =>
                        setDistributeYears((v) => {
                          const next = !v;
                          // Turning years on must also turn months on
                          if (next) setDistributeMonths(() => true);
                          return next;
                        })
                      }
                      style={[s.toggle, distributeYears && s.toggleOn]}
                      activeOpacity={0.8}
                      disabled={submitting}
                    >
                      <View style={[s.toggleThumb, distributeYears && s.toggleThumbOn]} />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

            </ScrollView>

            <View
              style={{
                paddingHorizontal: 20,
                paddingTop: 12,
                paddingBottom: insets.bottom + 24,
                marginBottom: keyboardVisible ? Math.max(0, keyboardHeight - insets.bottom + 8) : 0,
                gap: 10,
              }}
            >
              {error ? (
                <View style={s.errorRow}>
                  <Ionicons name="warning-outline" size={14} color={T.red} />
                  <Text style={s.errorTxt}>{error}</Text>
                </View>
              ) : null}

              <View style={{ flexDirection: "row", gap: 14 }}>
                <Pressable
                  style={[s.submitBtn, { flex: 1, backgroundColor: T.cardAlt, borderWidth: 1, borderColor: T.border }]}
                  onPress={() => {
                    if (submitting) return;
                    onClose();
                  }}
                  disabled={submitting}
                >
                  <Text style={[s.submitTxt, { color: T.text }]}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={[s.submitBtn, { flex: 1 }, (!canSubmit || submitting) && s.submitDisabled]}
                  onPress={handleSubmit}
                  disabled={!canSubmit || submitting}
                >
                  <Text style={s.submitTxt}>{submitting ? "Saving…" : "Save"}</Text>
                </Pressable>
              </View>
            </View>
          </View>

          {/* Android: inline picker */}
          {showPicker && Platform.OS === "android" ? (
            <DateTimePicker
              value={dueDateObj}
              mode="date"
              display="calendar"
              onChange={(event, selected) => {
                setShowPicker(false);
                if (event.type === "set" && selected) setDueDate(selected.toISOString().slice(0, 10));
              }}
            />
          ) : null}

          {/* iOS: picker overlay */}
          {Platform.OS === "ios" && showPicker ? (
            <View style={{ ...StyleSheet.absoluteFillObject, justifyContent: "flex-end" }}>
              <Pressable style={{ ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.45)" }} onPress={cancelPicker} />
              <View
                style={{
                  backgroundColor: T.card,
                  borderTopLeftRadius: 16,
                  borderTopRightRadius: 16,
                  paddingBottom: insets.bottom + 12,
                  borderTopWidth: 1,
                  borderTopColor: T.border,
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    paddingHorizontal: 20,
                    paddingVertical: 14,
                    borderBottomWidth: 1,
                    borderBottomColor: T.border,
                  }}
                >
                  <TouchableOpacity onPress={cancelPicker} hitSlop={10} disabled={submitting}>
                    <Text style={{ color: T.textMuted, fontSize: 16, fontWeight: "600" }}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={clearPicker} hitSlop={10} disabled={submitting}>
                    <Text style={{ color: T.red, fontSize: 16, fontWeight: "700" }}>Clear</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={confirmPicker} hitSlop={10} disabled={submitting}>
                    <Text style={{ color: T.accent, fontSize: 16, fontWeight: "700" }}>Done</Text>
                  </TouchableOpacity>
                </View>
                <DateTimePicker
                  value={iosDraft}
                  mode="date"
                  display="inline"
                  themeVariant="dark"
                  onChange={(event, selected) => {
                    const next =
                      selected ??
                      // Some iOS inline picker versions only provide a timestamp on the event.
                      (event?.nativeEvent?.timestamp ? new Date(event.nativeEvent.timestamp) : null);
                    if (next) setIosDraft(next);
                  }}
                  style={{ height: IOS_INLINE_CALENDAR_H }}
                />
              </View>
            </View>
          ) : null}
        </Animated.View>
      </View>
    </Modal>
  );
}

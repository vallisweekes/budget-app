import React, { useEffect, useMemo, useState } from "react";
import { Modal, Platform, Pressable, Text, View } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";

import { onboardingStyles as styles } from "@/components/OnboardingScreen/style";
import NumericInput from "@/components/Shared/NumericInput";
import { PAY_FREQUENCY_OPTIONS, STEP_ICON_COLORS } from "@/lib/constants";
import type { OnboardingPayScheduleSectionProps } from "@/types";

function parseDateOnly(value: string | null | undefined): Date | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const [year, month, day] = trimmed.split("-").map(Number);
    const parsed = new Date(year, month - 1, day);
    parsed.setHours(0, 0, 0, 0);
    return Number.isFinite(parsed.getTime()) ? parsed : null;
  }
  const parsed = new Date(trimmed);
  if (!Number.isFinite(parsed.getTime())) return null;
  parsed.setHours(0, 0, 0, 0);
  return parsed;
}

function formatDateOnly(value: Date): string {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

function formatDateLabel(value: Date | null): string {
  if (!value) return "Select a date";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(value);
}

function startOfDay(value: Date): Date {
  const next = new Date(value.getTime());
  next.setHours(0, 0, 0, 0);
  return next;
}

export default function OnboardingPayScheduleSection({ controller }: OnboardingPayScheduleSectionProps) {
  const selectedPayAnchorDate = useMemo(() => parseDateOnly(controller.payAnchorDate), [controller.payAnchorDate]);
  const [showPayAnchorDatePicker, setShowPayAnchorDatePicker] = useState(false);
  const [payAnchorDateDraft, setPayAnchorDateDraft] = useState<Date>(() => selectedPayAnchorDate ?? startOfDay(new Date()));

  useEffect(() => {
    if (selectedPayAnchorDate) {
      setPayAnchorDateDraft(selectedPayAnchorDate);
    }
  }, [selectedPayAnchorDate]);

  const openPayAnchorDatePicker = () => {
    setPayAnchorDateDraft(selectedPayAnchorDate ?? startOfDay(new Date()));
    setShowPayAnchorDatePicker(true);
  };

  const confirmPayAnchorDate = () => {
    controller.setPayAnchorDate(formatDateOnly(payAnchorDateDraft));
    setShowPayAnchorDatePicker(false);
  };

  return (
    <>
      <View style={styles.sectionCard}>
        <Text style={[styles.question, styles.sectionQuestionSpacing]}>How often do you get paid?</Text>
        <View style={styles.chipsWrap}>
          {PAY_FREQUENCY_OPTIONS.map((item) => {
            const active = controller.payFrequency === item.value;
            return (
              <Pressable key={item.value} onPress={() => controller.setPayFrequency(item.value)} style={[styles.chip, active && styles.chipActive]}>
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{item.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {controller.payFrequency === "monthly" ? (
        <View style={styles.sectionCard}>
          <View style={[styles.questionRow, styles.sectionQuestionRowSpacing]}>
            <Ionicons name="wallet-outline" size={20} color={STEP_ICON_COLORS[2]} />
            <Text style={styles.question}>What day of the month do you usually get paid?</Text>
          </View>
          <NumericInput
            value={controller.payDay}
            onChangeText={controller.setPayDay}
            placeholder="For example: 15"
            placeholderTextColor="rgba(255,255,255,0.62)"
            keyboardType="number-pad"
            style={styles.input}
            accessibilityLabel="Enter your payday as a day of the month"
          />
        </View>
      ) : null}

      {controller.payFrequency && controller.payFrequency !== "monthly" ? (
        <View style={styles.sectionCard}>
          <View style={[styles.questionRow, styles.sectionQuestionRowSpacing]}>
            <Ionicons name="calendar-outline" size={20} color={STEP_ICON_COLORS[2]} />
            <Text style={styles.question}>Enter the last date or the next date you are getting paid.</Text>
          </View>
          <Pressable
            onPress={openPayAnchorDatePicker}
            style={styles.dropdownTrigger}
            accessibilityRole="button"
            accessibilityLabel="Choose your last or next payday"
          >
            <Text style={[styles.dropdownTriggerText, !selectedPayAnchorDate && styles.dropdownTriggerPlaceholder]}>
              {formatDateLabel(selectedPayAnchorDate)}
            </Text>
            <Ionicons name="calendar-clear-outline" size={18} color="#ffffff" />
          </Pressable>
        </View>
      ) : null}

      {showPayAnchorDatePicker ? (
        <Modal visible transparent animationType="fade" presentationStyle="overFullScreen" onRequestClose={() => setShowPayAnchorDatePicker(false)}>
          <View style={styles.dateSheetOverlay}>
            <Pressable style={styles.dateSheetBackdrop} onPress={() => setShowPayAnchorDatePicker(false)} />
            <View style={styles.dateSheetCard}>
              <View style={styles.dateSheetHeader}>
                <Pressable onPress={() => setShowPayAnchorDatePicker(false)}>
                  <Text style={styles.dateSheetCancel}>Cancel</Text>
                </Pressable>
                <Text style={styles.dateSheetTitle}>Select payday</Text>
                <Pressable onPress={confirmPayAnchorDate}>
                  <Text style={styles.dateSheetDone}>Done</Text>
                </Pressable>
              </View>

              <DateTimePicker
                value={payAnchorDateDraft}
                mode="date"
                display={Platform.OS === "ios" ? "inline" : "calendar"}
                themeVariant={Platform.OS === "ios" ? "dark" : undefined}
                onChange={(event, selectedDate) => {
                  if (event.type === "dismissed") {
                    setShowPayAnchorDatePicker(false);
                    return;
                  }
                  if (selectedDate) {
                    setPayAnchorDateDraft(startOfDay(selectedDate));
                  }
                }}
                style={Platform.OS === "ios" ? { height: 340 } : undefined}
              />
            </View>
          </View>
        </Modal>
      ) : null}
    </>
  );
}
import React from "react";
import { Animated, Modal, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import type { MonthPickerSheetProps } from "@/types";
import { T } from "@/lib/theme";
import { SHORT_MONTHS } from "@/lib/hooks/useUnplannedExpenseScreenController";

import { styles } from "./style";

export default function MonthPickerSheet({ dragY, month, onClose, onMonthSelect, onNextYear, onPrevYear, panHandlers, pickerYear, visible, year }: MonthPickerSheetProps) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <Pressable style={styles.modalBackdrop} onPress={onClose} />
        <Animated.View style={[styles.modalSheet, { transform: [{ translateY: dragY }] }]}>
          <View style={styles.sheetHandle} {...panHandlers} />
          <View style={styles.pickerYearRow}>
            <Pressable onPress={onPrevYear} hitSlop={12} style={styles.pickerYearBtn}>
              <Ionicons name="chevron-back" size={22} color={T.text} />
            </Pressable>
            <Text style={styles.pickerYearText}>{pickerYear}</Text>
            <Pressable onPress={onNextYear} hitSlop={12} style={styles.pickerYearBtn}>
              <Ionicons name="chevron-forward" size={22} color={T.text} />
            </Pressable>
          </View>
          <View style={styles.pickerGrid}>
            {SHORT_MONTHS.map((name, idx) => {
              const monthValue = idx + 1;
              const isSelected = monthValue === month && pickerYear === year;

              return (
                <Pressable key={monthValue} onPress={() => onMonthSelect(monthValue)} style={[styles.pickerCell, isSelected && styles.pickerCellSelected]}>
                  <Text style={[styles.pickerCellText, isSelected && styles.pickerCellSelectedText]}>{name}</Text>
                </Pressable>
              );
            })}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}
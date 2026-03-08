import React from "react";
import { Modal, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { T } from "@/lib/theme";
import { categoryExpensesStyles as s } from "@/screens/categoryExpenses/styles";

type Props = {
  month: number;
  onClose: () => void;
  onSelectMonth: (month: number) => void;
  pickerYear: number;
  setPickerYear: React.Dispatch<React.SetStateAction<number>>;
  shortMonths: string[];
  visible: boolean;
  year: number;
};

export default function CategoryExpensesMonthPicker(props: Props) {
  return (
    <Modal visible={props.visible} transparent animationType="slide" onRequestClose={props.onClose}>
      <View style={s.pickerOverlay}>
        <Pressable style={s.pickerBackdrop} onPress={props.onClose} />
        <View style={s.pickerSheet}>
          <View style={s.pickerHandle} />

          <View style={s.pickerYearRow}>
            <Pressable onPress={() => props.setPickerYear((value) => value - 1)} hitSlop={12} style={s.pickerYearBtn}>
              <Ionicons name="chevron-back" size={22} color={T.text} />
            </Pressable>
            <Text style={s.pickerYearText}>{props.pickerYear}</Text>
            <Pressable onPress={() => props.setPickerYear((value) => value + 1)} hitSlop={12} style={s.pickerYearBtn}>
              <Ionicons name="chevron-forward" size={22} color={T.text} />
            </Pressable>
          </View>

          <View style={s.pickerGrid}>
            {props.shortMonths.map((label, idx) => {
              const selectedMonth = idx + 1;
              const isSelected = selectedMonth === props.month && props.pickerYear === props.year;
              return (
                <Pressable
                  key={selectedMonth}
                  onPress={() => props.onSelectMonth(selectedMonth)}
                  style={[s.pickerCell, isSelected && s.pickerCellSelected]}
                >
                  <Text style={[s.pickerCellText, isSelected && s.pickerCellSelectedText]}>{label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
}

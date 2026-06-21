import React from "react";
import { View, Text, Pressable, ScrollView, Modal, Animated } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { s } from "@/components/ScanReceiptScreen/style";
import { FUNDING_OPTIONS, NEW_LOAN_SENTINEL } from "@/lib/constants";
import { T } from "@/lib/theme";
import type { ScanReceiptScreenController } from "@/hooks";

type Props = Pick<
  ScanReceiptScreenController,
  | "catPickerOpen"
  | "closeCatPicker"
  | "catPickerDragY"
  | "catPickerPanHandlers"
  | "categoryId"
  | "setCategoryId"
  | "displayCategories"
  | "fundingPickerOpen"
  | "closeFundingPicker"
  | "fundingPickerDragY"
  | "fundingPickerPanHandlers"
  | "fundingSource"
  | "setFundingSource"
  | "debtPickerOpen"
  | "closeDebtPicker"
  | "debtPickerDragY"
  | "debtPickerPanHandlers"
  | "selectedDebtId"
  | "setSelectedDebtId"
  | "debtChoices"
  | "monthPickerOpen"
  | "closeMonthPicker"
  | "monthPickerDragY"
  | "monthPickerPanHandlers"
  | "pickerYear"
  | "setPickerYear"
  | "localizedMonthNamesShort"
  | "month"
  | "year"
  | "setMonth"
  | "setYear"
> & {
  fundingSource: ScanReceiptScreenController["fundingSource"];
};

export function ConfirmPickersModals(props: Props) {
  return (
    <>
      <Modal visible={props.catPickerOpen} transparent animationType="slide" onRequestClose={props.closeCatPicker}>
        <View style={s.modalOverlay}>
          <Pressable style={s.modalBackdrop} onPress={props.closeCatPicker} />
          <Animated.View style={[s.modalSheet, { transform: [{ translateY: props.catPickerDragY }] }]}>
            <View style={s.sheetHandle} {...props.catPickerPanHandlers} />
            <Text style={s.sheetTitle}>Category</Text>
            <ScrollView contentContainerStyle={s.catList}>
              <Pressable style={[s.catRow, !props.categoryId && s.catRowSelected]} onPress={() => { props.setCategoryId(""); props.closeCatPicker(); }}>
                <View style={[s.catDot, { backgroundColor: T.border }]} />
                <Text style={s.catName}>None</Text>
                {!props.categoryId ? <Ionicons name="checkmark" size={16} color={T.accent} style={s.catCheck} /> : null}
              </Pressable>
              {props.displayCategories.map((c) => (
                <Pressable key={c.id} style={[s.catRow, props.categoryId === c.id && s.catRowSelected]} onPress={() => { props.setCategoryId(c.id); props.closeCatPicker(); }}>
                  <View style={[s.catDot, { backgroundColor: c.color ?? T.accentDim }]} />
                  <Text style={s.catName}>{c.name}</Text>
                  {props.categoryId === c.id ? <Ionicons name="checkmark" size={16} color={T.accent} style={s.catCheck} /> : null}
                </Pressable>
              ))}
            </ScrollView>
          </Animated.View>
        </View>
      </Modal>

      <Modal visible={props.fundingPickerOpen} transparent animationType="slide" onRequestClose={props.closeFundingPicker}>
        <View style={s.modalOverlay}>
          <Pressable style={s.modalBackdrop} onPress={props.closeFundingPicker} />
          <Animated.View style={[s.modalSheet, { transform: [{ translateY: props.fundingPickerDragY }] }]}>
            <View style={s.sheetHandle} {...props.fundingPickerPanHandlers} />
            <Text style={s.sheetTitle}>Funds From</Text>
            <ScrollView contentContainerStyle={s.catList}>
              {FUNDING_OPTIONS.map((opt) => (
                <Pressable key={opt.value} style={[s.catRow, props.fundingSource === opt.value && s.catRowSelected]} onPress={() => { props.setFundingSource(opt.value); props.closeFundingPicker(); }}>
                  <Text style={s.catName}>{opt.label}</Text>
                  {props.fundingSource === opt.value ? <Ionicons name="checkmark" size={16} color={T.accent} style={s.catCheck} /> : null}
                </Pressable>
              ))}
            </ScrollView>
          </Animated.View>
        </View>
      </Modal>

      <Modal visible={props.debtPickerOpen} transparent animationType="slide" onRequestClose={props.closeDebtPicker}>
        <View style={s.modalOverlay}>
          <Pressable style={s.modalBackdrop} onPress={props.closeDebtPicker} />
          <Animated.View style={[s.modalSheet, { transform: [{ translateY: props.debtPickerDragY }] }]}>
            <View style={s.sheetHandle} {...props.debtPickerPanHandlers} />
            <Text style={s.sheetTitle}>{props.fundingSource === "credit_card" ? "Choose Card" : "Choose Loan"}</Text>
            <ScrollView contentContainerStyle={s.catList}>
              {props.fundingSource === "loan" ? (
                <Pressable style={[s.catRow, props.selectedDebtId === NEW_LOAN_SENTINEL && s.catRowSelected]} onPress={() => { props.setSelectedDebtId(NEW_LOAN_SENTINEL); props.closeDebtPicker(); }}>
                  <Text style={s.catName}>+ Create new loan</Text>
                  {props.selectedDebtId === NEW_LOAN_SENTINEL ? <Ionicons name="checkmark" size={16} color={T.accent} style={s.catCheck} /> : null}
                </Pressable>
              ) : null}
              {props.debtChoices.map((d) => (
                <Pressable key={d.id} style={[s.catRow, props.selectedDebtId === d.id && s.catRowSelected]} onPress={() => { props.setSelectedDebtId(d.id); props.closeDebtPicker(); }}>
                  <Text style={s.catName}>{d.name}</Text>
                  {props.selectedDebtId === d.id ? <Ionicons name="checkmark" size={16} color={T.accent} style={s.catCheck} /> : null}
                </Pressable>
              ))}
              {props.debtChoices.length === 0 ? <Text style={[s.fieldPlaceholder, { paddingVertical: 8 }]}>No options found.</Text> : null}
            </ScrollView>
          </Animated.View>
        </View>
      </Modal>

      <Modal visible={props.monthPickerOpen} transparent animationType="slide" onRequestClose={props.closeMonthPicker}>
        <View style={s.modalOverlay}>
          <Pressable style={s.modalBackdrop} onPress={props.closeMonthPicker} />
          <Animated.View style={[s.modalSheet, { transform: [{ translateY: props.monthPickerDragY }] }]}>
            <View style={s.sheetHandle} {...props.monthPickerPanHandlers} />
            <View style={s.pickerYearRow}>
              <Pressable onPress={() => props.setPickerYear((y) => y - 1)} hitSlop={12} style={s.pickerYearBtn}>
                <Ionicons name="chevron-back" size={22} color={T.text} />
              </Pressable>
              <Text style={s.pickerYearText}>{props.pickerYear}</Text>
              <Pressable onPress={() => props.setPickerYear((y) => y + 1)} hitSlop={12} style={s.pickerYearBtn}>
                <Ionicons name="chevron-forward" size={22} color={T.text} />
              </Pressable>
            </View>
            <View style={s.pickerGrid}>
              {props.localizedMonthNamesShort.map((monthName, idx) => {
                const nextMonth = idx + 1;
                const isSelected = nextMonth === props.month && props.pickerYear === props.year;
                return (
                  <Pressable key={nextMonth} onPress={() => { props.setMonth(nextMonth); props.setYear(props.pickerYear); props.closeMonthPicker(); }} style={[s.pickerCell, isSelected && s.pickerCellSelected]}>
                    <Text style={[s.pickerCellText, isSelected && s.pickerCellSelectedText]}>{monthName}</Text>
                  </Pressable>
                );
              })}
            </View>
          </Animated.View>
        </View>
      </Modal>
    </>
  );
}

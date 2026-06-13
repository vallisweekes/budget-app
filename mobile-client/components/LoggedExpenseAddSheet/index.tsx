import React, { useEffect, useRef } from "react";
import {
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  Text,
  View,
  StyleSheet,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { useAppLocale, useSwipeDownToClose, useUnplannedExpenseScreenController } from "@/hooks";
import { NEW_LOAN_SENTINEL } from "@/lib/constants";
import { currencySymbol } from "@/lib/formatting";
import { T } from "@/lib/theme";
import type { SelectionItem } from "@/types";

import MonthPickerSheet from "@/components/UnplannedExpenseScreen/MonthPickerSheet";
import SelectionSheet from "@/components/UnplannedExpenseScreen/SelectionSheet";
import UnplannedExpenseForm from "@/components/UnplannedExpenseScreen/UnplannedExpenseForm";

const { height: SCREEN_H } = Dimensions.get("window");
const SHEET_HEIGHT = SCREEN_H * 0.925;

type Props = {
  visible: boolean;
  onClose: () => void;
  month?: number;
  year?: number;
};

export default function LoggedExpenseAddSheet({ visible, onClose, month, year }: Props) {
  const insets = useSafeAreaInsets();
  const { translateCategoryName } = useAppLocale();
  const slideY = useRef(new Animated.Value(SCREEN_H)).current;

  const { dragY, panHandlers } = useSwipeDownToClose({ onClose });

  useEffect(() => {
    Animated.spring(slideY, {
      toValue: visible ? 0 : SCREEN_H,
      useNativeDriver: true,
      bounciness: 3,
      speed: 18,
    }).start();
  }, [visible, slideY]);

  const controller = useUnplannedExpenseScreenController({
    onSuccess: onClose,
    initialPeriod: { month, year, sourceContext: "logged_expenses" },
  });

  const currency = currencySymbol(controller.settings?.currency);

  const categoryItems: SelectionItem[] = [
    { id: "", label: "None", color: T.border },
    ...controller.categories.map((cat) => ({
      id: cat.id,
      label: translateCategoryName(cat.name),
      color: cat.color ?? T.accentDim,
    })),
  ];
  const fundingItems: SelectionItem[] = controller.fundingOptions.map((o) => ({
    id: o.key,
    label: o.label,
  }));
  const debtItems: SelectionItem[] = [
    ...(controller.fundingSource === "loan"
      ? [{ id: NEW_LOAN_SENTINEL, label: "+ Create new loan" }]
      : []),
    ...controller.debtChoices.map((d) => ({ id: d.id, label: d.name })),
  ];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        {/* Backdrop */}
        <Pressable style={styles.backdrop} onPress={onClose} />

        {/* Sheet */}
        <Animated.View
          style={[
            styles.sheet,
            { transform: [{ translateY: Animated.add(slideY, dragY) }] },
          ]}
        >
          {/* Drag handle */}
          <View style={styles.handle} {...panHandlers} />

          {/* Header */}
          <View style={styles.header} {...panHandlers}>
            <Text style={styles.headerTitle}>Log Expense</Text>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close"
              style={styles.closeBtn}
            >
              <Ionicons name="close" size={20} color={T.textDim} />
            </Pressable>
          </View>

          <KeyboardAvoidingView
            style={styles.flex}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
          >
            <View style={[styles.flex, { paddingBottom: insets.bottom }]}>
              <UnplannedExpenseForm
                amount={controller.amount}
                canSubmit={controller.canSubmit}
                categoryId={controller.categoryId}
                currency={currency}
                fundingLabel={controller.fundingLabel}
                fundingSource={controller.fundingSource}
                loadingData={controller.loadingData}
                name={controller.name}
                needsDebtChoice={controller.needsDebtChoice}
                newLoanName={controller.newLoanName}
                parsedAmount={controller.parsedAmount}
                periodLabel={controller.periodLabel}
                selectedCategory={
                  controller.selectedCategory
                    ? {
                        ...controller.selectedCategory,
                        name: translateCategoryName(controller.selectedCategory.name),
                      }
                    : controller.selectedCategory
                }
                selectedDebt={controller.selectedDebt}
                submitError={controller.submitError}
                submitting={controller.submitting}
                topContentInset={8}
                usingNewLoan={controller.usingNewLoan}
                onAmountChange={controller.setAmount}
                onCategoryPress={() => controller.setCatPickerOpen(true)}
                onDebtPress={() => controller.setDebtPickerOpen(true)}
                onDescriptionChange={controller.setName}
                onFundingPress={() => controller.setFundingPickerOpen(true)}
                onPeriodPress={() => {
                  controller.setPickerYear(controller.year);
                  controller.setMonthPickerOpen(true);
                }}
                onNewLoanNameChange={controller.setNewLoanName}
                onScanReceiptPress={() => {}}
                onSubmit={() => void controller.handleSubmit()}
              />
            </View>
          </KeyboardAvoidingView>
        </Animated.View>
      </View>

      <SelectionSheet
        dragY={controller.catPickerDragY}
        items={categoryItems}
        onClose={controller.closeCatPicker}
        onSelect={(id) => {
          controller.setCategoryTouched(true);
          controller.setCategoryId(id);
          controller.closeCatPicker();
        }}
        panHandlers={controller.catPickerPanHandlers}
        selectedId={controller.categoryId}
        title="Category"
        visible={controller.catPickerOpen}
      />

      <SelectionSheet
        dragY={controller.fundingPickerDragY}
        items={fundingItems}
        onClose={controller.closeFundingPicker}
        onSelect={(id) => {
          const option = controller.fundingOptions.find((o) => o.key === id);
          if (option) controller.handleFundingOptionSelect(option);
          controller.closeFundingPicker();
        }}
        panHandlers={controller.fundingPickerPanHandlers}
        selectedId={controller.selectedFundingKey}
        title="Funds From"
        visible={controller.fundingPickerOpen}
      />

      <SelectionSheet
        dragY={controller.debtPickerDragY}
        emptyText="No options found."
        items={debtItems}
        onClose={controller.closeDebtPicker}
        onSelect={(id) => {
          controller.setSelectedDebtId(id);
          controller.closeDebtPicker();
        }}
        panHandlers={controller.debtPickerPanHandlers}
        selectedId={controller.selectedDebtId}
        title="Choose Loan"
        visible={controller.debtPickerOpen}
      />

      <MonthPickerSheet
        dragY={controller.monthPickerDragY}
        month={controller.month}
        onClose={controller.closeMonthPicker}
        onMonthSelect={(nextMonth) => {
          controller.setMonth(nextMonth);
          controller.setYear(controller.pickerYear);
          controller.closeMonthPicker();
        }}
        onNextYear={() => controller.setPickerYear((v) => v + 1)}
        onPrevYear={() => controller.setPickerYear((v) => v - 1)}
        panHandlers={controller.monthPickerPanHandlers}
        pickerYear={controller.pickerYear}
        visible={controller.monthPickerOpen}
        year={controller.year}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    paddingTop: 18,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.62)",
  },
  sheet: {
    backgroundColor: T.bg,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    height: SHEET_HEIGHT,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: T.border,
    overflow: "hidden",
    shadowColor: "#000000",
    shadowOpacity: 0.34,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: -10 },
    elevation: 24,
  },
  handle: {
    width: 48,
    height: 5,
    borderRadius: 999,
    backgroundColor: T.border,
    alignSelf: "center",
    marginTop: 12,
    marginBottom: 6,
  },
  flex: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: T.border,
  },
  headerTitle: {
    color: T.text,
    fontSize: 21,
    fontWeight: "900",
    letterSpacing: -0.3,
  },
  closeBtn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: T.border,
  },
});

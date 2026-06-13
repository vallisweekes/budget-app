import React from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  Text,
  View,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { useAppLocale, useUnplannedExpenseScreenController } from "@/hooks";
import { NEW_LOAN_SENTINEL } from "@/lib/constants";
import { currencySymbol } from "@/lib/formatting";
import { T } from "@/lib/theme";
import type { SelectionItem } from "@/types";

import MonthPickerSheet from "@/components/UnplannedExpenseScreen/MonthPickerSheet";
import SelectionSheet from "@/components/UnplannedExpenseScreen/SelectionSheet";
import UnplannedExpenseForm from "@/components/UnplannedExpenseScreen/UnplannedExpenseForm";

type Props = {
  visible: boolean;
  onClose: () => void;
  month?: number;
  year?: number;
};

export default function LoggedExpenseAddSheet({ visible, onClose, month, year }: Props) {
  const { translateCategoryName } = useAppLocale();

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
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.safe} edges={["bottom"]}>
        {/* header row */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Log Expense</Text>
          <Pressable
            onPress={onClose}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Close"
            style={styles.closeBtn}
          >
            <Ionicons name="close" size={22} color={T.textDim} />
          </Pressable>
        </View>

        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={styles.flex}>
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
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: T.bg,
  },
  flex: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  headerTitle: {
    color: T.text,
    fontSize: 17,
    fontWeight: "700",
    flex: 1,
    textAlign: "center",
  },
  closeBtn: {
    position: "absolute",
    right: 20,
    top: 16,
  },
});

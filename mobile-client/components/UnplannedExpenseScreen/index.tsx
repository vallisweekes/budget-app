import React from "react";
import { KeyboardAvoidingView, Platform, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import type { SelectionItem, UnplannedExpenseScreenProps } from "@/types";
import { currencySymbol } from "@/lib/formatting";
import { useTopHeaderOffset } from "@/lib/hooks/useTopHeaderOffset";
import { T } from "@/lib/theme";
import {
  FUNDING_OPTIONS,
  NEW_LOAN_SENTINEL,
  useUnplannedExpenseScreenController,
} from "@/lib/hooks/useUnplannedExpenseScreenController";

import MonthPickerSheet from "./MonthPickerSheet";
import SelectionSheet from "./SelectionSheet";
import { styles } from "./style";
import UnplannedExpenseForm from "./UnplannedExpenseForm";

export default function UnplannedExpenseScreen({ navigation }: UnplannedExpenseScreenProps) {
  const topOffset = useTopHeaderOffset();
  const controller = useUnplannedExpenseScreenController(() => navigation.goBack());
  const currency = currencySymbol(controller.settings?.currency);
  const categoryItems: SelectionItem[] = [
    { id: "", label: "None", color: T.border },
    ...controller.categories.map((category) => ({ id: category.id, label: category.name, color: category.color ?? T.accentDim })),
  ];
  const fundingItems: SelectionItem[] = FUNDING_OPTIONS.map((option) => ({ id: option.value, label: option.label }));
  const debtItems: SelectionItem[] = [
    ...(controller.fundingSource === "loan" ? [{ id: NEW_LOAN_SENTINEL, label: "+ Create new loan" }] : []),
    ...controller.debtChoices.map((debt) => ({ id: debt.id, label: debt.name })),
  ];

  return (
    <SafeAreaView style={styles.safe} edges={[]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={[styles.flex, { paddingTop: topOffset + 12 }]}>
          <UnplannedExpenseForm
            amount={controller.amount}
            canSubmit={controller.canSubmit}
            categoryId={controller.categoryId}
            currency={currency}
            fundingLabel={controller.fundingLabel}
            fundingSource={controller.fundingSource}
            loadingData={controller.loadingData}
            month={controller.month}
            name={controller.name}
            needsDebtChoice={controller.needsDebtChoice}
            newLoanName={controller.newLoanName}
            parsedAmount={controller.parsedAmount}
            selectedCategory={controller.selectedCategory}
            selectedDebt={controller.selectedDebt}
            submitError={controller.submitError}
            submitting={controller.submitting}
            usingNewLoan={controller.usingNewLoan}
            year={controller.year}
            onAmountChange={controller.setAmount}
            onCategoryPress={() => controller.setCatPickerOpen(true)}
            onDebtPress={() => controller.setDebtPickerOpen(true)}
            onDescriptionChange={controller.setName}
            onFundingPress={() => controller.setFundingPickerOpen(true)}
            onMonthPress={() => {
              controller.setPickerYear(controller.year);
              controller.setMonthPickerOpen(true);
            }}
            onNewLoanNameChange={controller.setNewLoanName}
            onScanReceiptPress={() => navigation.navigate("ScanReceipt")}
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
          controller.setFundingSource(id as (typeof FUNDING_OPTIONS)[number]["value"]);
          controller.closeFundingPicker();
        }}
        panHandlers={controller.fundingPickerPanHandlers}
        selectedId={controller.fundingSource}
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
        title={controller.fundingSource === "credit_card" ? "Choose Card" : "Choose Loan"}
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
        onNextYear={() => controller.setPickerYear((value) => value + 1)}
        onPrevYear={() => controller.setPickerYear((value) => value - 1)}
        panHandlers={controller.monthPickerPanHandlers}
        pickerYear={controller.pickerYear}
        visible={controller.monthPickerOpen}
        year={controller.year}
      />
    </SafeAreaView>
  );
}

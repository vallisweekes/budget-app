import React from "react";

import type { ScanReceiptScreenProps } from "@/types";
import { useScanReceiptScreenController } from "@/hooks";
import { ConfirmFormView } from "@/components/ScanReceiptScreen/ConfirmFormView";
import { ConfirmPickersModals } from "@/components/ScanReceiptScreen/ConfirmPickersModals";
import { PickStageView } from "@/components/ScanReceiptScreen/PickStageView";
import { ScanningStageView } from "@/components/ScanReceiptScreen/ScanningStageView";

export default function ScanReceiptScreen({ navigation }: ScanReceiptScreenProps) {
  const controller = useScanReceiptScreenController(navigation);
  const saving = controller.stage === "saving";

  if (controller.stage === "scanning") {
    return (
      <ScanningStageView
        topOffset={controller.topOffset}
        previewUri={controller.previewUri}
        shimmerOpacity={controller.shimmerOpacity}
      />
    );
  }

  if (controller.stage === "confirm" || controller.stage === "saving") {
    return (
      <>
        <ConfirmFormView
          topOffset={controller.topOffset}
          previewUri={controller.previewUri}
          settingsCurrency={controller.settings?.currency}
          amount={controller.amount}
          onAmountChange={controller.setAmount}
          name={controller.name}
          onNameChange={controller.setName}
          selectedCategoryName={controller.selectedCategory?.name ?? null}
          selectedCategoryColor={controller.selectedCategory?.color ?? null}
          onOpenCategory={() => {
            if (!saving) controller.setCatPickerOpen(true);
          }}
          fundingLabel={controller.fundingLabel}
          onOpenFunding={() => {
            if (!saving) controller.setFundingPickerOpen(true);
          }}
          needsDebtChoice={controller.needsDebtChoice}
          fundingSource={controller.fundingSource}
          selectedDebtName={controller.selectedDebt?.name ?? null}
          usingNewLoan={controller.usingNewLoan}
          onOpenDebt={() => {
            if (!saving) controller.setDebtPickerOpen(true);
          }}
          newLoanName={controller.newLoanName}
          onNewLoanNameChange={controller.setNewLoanName}
          monthLabel={`${controller.localizedMonthNamesLong[controller.month - 1]} ${controller.year}`}
          onOpenMonth={() => {
            if (!saving) {
              controller.setPickerYear(controller.year);
              controller.setMonthPickerOpen(true);
            }
          }}
          saveError={controller.saveError}
          canSave={controller.canSave}
          saving={saving}
          onConfirm={controller.handleConfirm}
          parsedAmount={controller.parsedAmount}
          currency={controller.currency}
        />

        <ConfirmPickersModals
          catPickerOpen={controller.catPickerOpen}
          closeCatPicker={controller.closeCatPicker}
          catPickerDragY={controller.catPickerDragY}
          catPickerPanHandlers={controller.catPickerPanHandlers}
          categoryId={controller.categoryId}
          setCategoryId={controller.setCategoryId}
          displayCategories={controller.displayCategories}
          fundingPickerOpen={controller.fundingPickerOpen}
          closeFundingPicker={controller.closeFundingPicker}
          fundingPickerDragY={controller.fundingPickerDragY}
          fundingPickerPanHandlers={controller.fundingPickerPanHandlers}
          fundingSource={controller.fundingSource}
          setFundingSource={controller.setFundingSource}
          debtPickerOpen={controller.debtPickerOpen}
          closeDebtPicker={controller.closeDebtPicker}
          debtPickerDragY={controller.debtPickerDragY}
          debtPickerPanHandlers={controller.debtPickerPanHandlers}
          selectedDebtId={controller.selectedDebtId}
          setSelectedDebtId={controller.setSelectedDebtId}
          debtChoices={controller.debtChoices}
          monthPickerOpen={controller.monthPickerOpen}
          closeMonthPicker={controller.closeMonthPicker}
          monthPickerDragY={controller.monthPickerDragY}
          monthPickerPanHandlers={controller.monthPickerPanHandlers}
          pickerYear={controller.pickerYear}
          setPickerYear={controller.setPickerYear}
          localizedMonthNamesShort={controller.localizedMonthNamesShort}
          month={controller.month}
          year={controller.year}
          setMonth={controller.setMonth}
          setYear={controller.setYear}
        />
      </>
    );
  }

  return (
    <PickStageView
      topOffset={controller.topOffset}
      scanError={controller.scanError}
      onLaunchCamera={controller.launchCamera}
      onLaunchGallery={controller.launchGallery}
    />
  );
}

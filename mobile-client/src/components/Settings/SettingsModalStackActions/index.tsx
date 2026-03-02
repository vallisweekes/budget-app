import React from "react";
import { Platform } from "react-native";

import DeleteConfirmSheet from "@/components/Shared/DeleteConfirmSheet";
import SettingsCreatePlanSheet from "@/components/Settings/SettingsCreatePlanSheet";
import SettingsDebtSheet from "@/components/Settings/SettingsDebtSheet";
import SettingsIosDatePickerModal from "@/components/Settings/SettingsIosDatePickerModal";

import type { SettingsModalStackActionsProps } from "@/types/components/settings/SettingsModalStackActions.types";

export default function SettingsModalStackActions({ controller }: SettingsModalStackActionsProps) {
  return (
    <>
      <SettingsDebtSheet
        visible={!!controller.editDebtTarget}
        title="Edit credit card"
        actionLabel="Save"
        currency={controller.settings?.currency}
        insetsBottom={controller.insets.bottom}
        keyboardOffset={Platform.OS === "ios" ? Math.max(0, controller.topHeaderOffset - controller.insets.top) : 0}
        translateY={controller.editDebtSheetDragY}
        panHandlers={controller.editDebtSheetPanHandlers as Record<string, unknown>}
        name={controller.editDebtName}
        balance={controller.editDebtBalance}
        interestRate={controller.editDebtInterestRate}
        creditLimit={controller.editDebtLimit}
        saveBusy={controller.saveBusy}
        onClose={controller.closeEditDebtSheet}
        onChangeName={controller.setEditDebtName}
        onChangeBalance={controller.setEditDebtBalance}
        onChangeInterestRate={controller.setEditDebtInterestRate}
        onChangeCreditLimit={controller.setEditDebtLimit}
        onSubmit={controller.saveDebtEdit}
      />

      <SettingsDebtSheet
        visible={controller.addDebtSheetOpen}
        title="Add credit card"
        actionLabel="Add"
        currency={controller.settings?.currency}
        insetsBottom={controller.insets.bottom}
        keyboardOffset={Platform.OS === "ios" ? Math.max(0, controller.topHeaderOffset - controller.insets.top) : 0}
        translateY={controller.addDebtSheetDragY}
        panHandlers={controller.addDebtSheetPanHandlers as Record<string, unknown>}
        name={controller.addDebtName}
        balance={controller.addDebtBalance}
        interestRate={controller.addDebtInterestRate}
        creditLimit={controller.addDebtLimit}
        saveBusy={controller.saveBusy}
        onClose={controller.closeAddDebtSheet}
        onChangeName={controller.setAddDebtName}
        onChangeBalance={controller.setAddDebtBalance}
        onChangeInterestRate={controller.setAddDebtInterestRate}
        onChangeCreditLimit={controller.setAddDebtLimit}
        onSubmit={controller.addDebt}
      />

      <SettingsCreatePlanSheet
        visible={controller.createPlanSheetOpen}
        keyboardOffset={Platform.OS === "ios" ? Math.max(0, controller.topHeaderOffset - controller.insets.top) : 0}
        translateY={controller.createPlanSheetDragY}
        panHandlers={controller.createPlanSheetPanHandlers as Record<string, unknown>}
        newPlanType={controller.newPlanType}
        newPlanName={controller.newPlanName}
        newPlanEventDate={controller.newPlanEventDate}
        showPlanEventDatePicker={controller.showPlanEventDatePicker}
        saveBusy={controller.saveBusy}
        onClose={controller.closeCreatePlanSheet}
        onChangePlanType={controller.setNewPlanType}
        onChangePlanName={controller.setNewPlanName}
        onOpenDatePicker={controller.openPlanEventDatePicker}
        onCloseDatePicker={() => controller.setShowPlanEventDatePicker(false)}
        onAndroidDateChange={controller.setNewPlanEventDate}
        onCreate={controller.createSubPlan}
      />

      <DeleteConfirmSheet
        visible={!!controller.planDeleteTarget}
        title="Delete sub plan"
        description={`Delete ${controller.planDeleteTarget?.name ?? "this plan"}? This cannot be undone.`}
        confirmText={controller.deletingPlanId ? "Deleting…" : "Delete"}
        isBusy={!!controller.deletingPlanId}
        onClose={() => controller.setPlanDeleteTarget(null)}
        onConfirm={() => {
          void controller.confirmDeletePlan();
        }}
      />

      {Platform.OS === "ios" ? (
        <SettingsIosDatePickerModal
          visible={controller.showPlanEventDatePicker}
          draftDate={controller.iosPlanEventDraft}
          onCancel={controller.cancelPlanEventDatePicker}
          onDone={controller.closePlanEventDatePicker}
          onChangeDraftDate={controller.setIosPlanEventDraft}
        />
      ) : null}
    </>
  );
}

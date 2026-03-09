import React from "react";
import { Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import SettingsBudgetFieldSheet from "@/components/Settings/SettingsBudgetFieldSheet";
import SettingsLocaleSheet from "@/components/Settings/SettingsLocaleSheet";
import SavingsEditorSheet from "@/components/Settings/SavingsEditorSheet";
import { BILL_FREQUENCY_OPTIONS, PAY_FREQUENCY_OPTIONS } from "@/lib/constants";
import { asMoneyNumber, asMoneyText, getSavingsFieldTitle } from "@/lib/helpers/settings";

import type { SettingsModalStackEditorsProps } from "@/types/components/settings/SettingsModalStackEditors.types";

export default function SettingsModalStackEditors({ controller }: SettingsModalStackEditorsProps) {
  const keyboardOffset = Platform.OS === "ios" ? Math.max(0, controller.topHeaderOffset - controller.insets.top) : 0;

  return (
    <>
      <SettingsBudgetFieldSheet
        field={controller.budgetFieldSheet}
        keyboardOffset={keyboardOffset}
        translateY={controller.budgetFieldSheetDragY}
        panHandlers={controller.budgetFieldSheetPanHandlers as Record<string, unknown>}
        payDateDraft={controller.payDateDraft}
        horizonDraft={controller.horizonDraft}
        payFrequencyDraft={controller.payFrequencyDraft}
        billFrequencyDraft={controller.billFrequencyDraft}
        payFrequencyOptions={PAY_FREQUENCY_OPTIONS}
        billFrequencyOptions={BILL_FREQUENCY_OPTIONS}
        saveBusy={controller.saveBusy}
        onClose={controller.closeBudgetFieldSheet}
        onChangePayDate={controller.setPayDateDraft}
        onChangeHorizon={controller.setHorizonDraft}
        onChangePayFrequency={controller.setPayFrequencyDraft}
        onChangeBillFrequency={controller.setBillFrequencyDraft}
        onSave={controller.saveBudgetField}
      />

      <SavingsEditorSheet
        visible={controller.savingsSheetField !== null}
        keyboardOffset={keyboardOffset}
        mode={controller.savingsSheetMode}
        field={controller.savingsSheetField}
        icon={controller.savingsSheetIcon as React.ComponentProps<typeof Ionicons>["name"]}
        title={getSavingsFieldTitle(controller.savingsSheetField ?? "savings")}
        currency={controller.settings?.currency}
        currentAmount={controller.savingsSheetCurrentAmount}
        valueDraft={controller.savingsValueDraft}
        potNameDraft={controller.savingsSheetMode === "add" ? controller.savingsPotNameDraft : (controller.savingsEditingPotId ? controller.savingsPotNameDraft || "Pot" : getSavingsFieldTitle(controller.savingsSheetField ?? "savings"))}
        goalImpactNote={controller.savingsSheetGoalImpactNote}
        saveBusy={controller.saveBusy}
        insetsBottom={controller.insets.bottom}
        translateY={controller.savingsSheetDragY}
        panHandlers={controller.savingsSheetPanHandlers as Record<string, unknown>}
        formatMoneyText={(value) => `${controller.cur}${asMoneyText(value)}`}
        parseMoneyNumber={asMoneyNumber}
        onClose={controller.closeSavingsSheet}
        onChangeValue={controller.setSavingsValueDraft}
        onChangePotName={controller.setSavingsPotNameDraft}
        onDelete={controller.deleteSavingsItem}
        onSave={controller.saveSavingsField}
      />

      <SettingsLocaleSheet
        visible={controller.localeSheetOpen}
        keyboardOffset={keyboardOffset}
        translateY={controller.localeSheetDragY}
        panHandlers={controller.localeSheetPanHandlers as Record<string, unknown>}
        countryDraft={controller.countryDraft}
        detectedCountry={controller.detectedCountry}
        saveBusy={controller.saveBusy}
        onClose={controller.closeLocaleSheet}
        onChangeCountry={(value) => controller.setCountryDraft(value.toUpperCase())}
        onSave={() => {
          void controller.saveCountry();
        }}
      />
    </>
  );
}

import React from "react";
import { Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import SettingsBudgetFieldSheet from "@/components/Settings/SettingsBudgetFieldSheet";
import SettingsLocaleSheet from "@/components/Settings/SettingsLocaleSheet";
import SavingsEditorSheet from "@/components/Settings/SavingsEditorSheet";
import { useAppTranslation } from "@/hooks";
import { PAY_FREQUENCY_OPTIONS } from "@/lib/constants";
import { asMoneyNumber, asMoneyText } from "@/lib/helpers/settings";

import type { SettingsModalStackEditorsProps } from "@/types/components/settings/SettingsModalStackEditors.types";

export default function SettingsModalStackEditors({ controller }: SettingsModalStackEditorsProps) {
  const { t } = useAppTranslation(controller.settings?.language);
  const keyboardOffset = Platform.OS === "ios" ? Math.max(0, controller.topHeaderOffset - controller.insets.top) : 0;
  const savingsFieldTitle = controller.savingsSheetField === "emergency"
    ? t("settings.money.emergencyFunds")
    : controller.savingsSheetField === "investment"
      ? t("settings.money.investments")
      : t("settings.money.savings");

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
        payFrequencyOptions={PAY_FREQUENCY_OPTIONS}
        saveBusy={controller.saveBusy}
        onClose={controller.closeBudgetFieldSheet}
        onChangePayDate={controller.setPayDateDraft}
        onChangeHorizon={controller.setHorizonDraft}
        onChangePayFrequency={controller.setPayFrequencyDraft}
        onSave={controller.saveBudgetField}
      />

      <SavingsEditorSheet
        visible={controller.savingsSheetField !== null}
        keyboardOffset={keyboardOffset}
        mode={controller.savingsSheetMode}
        field={controller.savingsSheetField}
        icon={controller.savingsSheetIcon as React.ComponentProps<typeof Ionicons>["name"]}
        title={savingsFieldTitle}
        currency={controller.settings?.currency}
        currentAmount={controller.savingsSheetCurrentAmount}
        valueDraft={controller.savingsValueDraft}
        potNameDraft={controller.savingsSheetMode === "add" ? controller.savingsPotNameDraft : (controller.savingsEditingPotId ? controller.savingsPotNameDraft || t("settings.savingsEditor.potName") : savingsFieldTitle)}
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
        languageDraft={controller.languageDraft}
        detectedCountry={controller.detectedCountry}
        saveBusy={controller.saveBusy}
        onClose={controller.closeLocaleSheet}
        onChangeCountry={(value) => controller.setCountryDraft(value.toUpperCase())}
        onChangeLanguage={controller.setLanguageDraft}
        onSave={() => {
          void controller.saveLocale();
        }}
      />
    </>
  );
}

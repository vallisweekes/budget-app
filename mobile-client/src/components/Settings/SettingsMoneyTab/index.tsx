import React from "react";
import { Animated, Pressable, Text, View } from "react-native";

import { styles } from "./styles";
import SettingsMoneyCardsView from "@/components/Settings/SettingsMoneyCardsView";
import SettingsMoneyPersonalView from "@/components/Settings/SettingsMoneyPersonalView";
import type { SettingsMoneyTabProps } from "@/types/components/settings/SettingsMoneyTab.types";

export default function SettingsMoneyTab(props: SettingsMoneyTabProps) {
  const {
    mode,
    toggleTranslateX,
    tileSize,
    currency,
    savingsCards,
    savingsPotsByField,
    creditCardGroups,
    storeCardGroups,
    asMoneyText,
    getAddPotLabel,
    getSavingsTilePalette,
    onChangeMode,
    onOpenSavingsEditor,
    onOpenSavingsField,
    onAddDebt,
    onOpenDebtEditor,
  } = props;

  return (
    <View style={styles.moneyTabSurface}>
      <View style={styles.moneyToggleWrap}>
        <Animated.View pointerEvents="none" style={[styles.moneyToggleThumb, { transform: [{ translateX: toggleTranslateX }] }]} />
        <Pressable onPress={() => onChangeMode("personal")} style={styles.moneyTogglePill}>
          <Text style={[styles.moneyToggleTxt, mode === "personal" && styles.moneyToggleTxtActive]}>Personal</Text>
        </Pressable>
        <Pressable onPress={() => onChangeMode("cards")} style={styles.moneyTogglePill}>
          <Text style={[styles.moneyToggleTxt, mode === "cards" && styles.moneyToggleTxtActive]}>Cards</Text>
        </Pressable>
      </View>

      {mode === "personal" ? (
        <SettingsMoneyPersonalView
          currency={currency}
          tileSize={tileSize}
          savingsCards={savingsCards}
          savingsPotsByField={savingsPotsByField}
          asMoneyText={asMoneyText}
          getAddPotLabel={getAddPotLabel}
          getSavingsTilePalette={getSavingsTilePalette}
          onOpenSavingsEditor={onOpenSavingsEditor}
          onOpenSavingsField={onOpenSavingsField}
        />
      ) : (
        <SettingsMoneyCardsView
          currency={currency}
          creditCardGroups={creditCardGroups}
          storeCardGroups={storeCardGroups}
          onAddDebt={onAddDebt}
          onOpenDebtEditor={onOpenDebtEditor}
        />
      )}
    </View>
  );
}

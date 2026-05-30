import React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useAppTranslation } from "@/hooks";
import { styles } from "./styles";

import type { SettingsMoneyPersonalViewProps } from "@/types/components/settings/SettingsMoneyPersonalView.types";

export default function SettingsMoneyPersonalView({
  currency,
  tileSize,
  savingsCards,
  savingsPotsByField,
  asMoneyText,
  getAddPotLabel,
  getSavingsTilePalette,
  onOpenSavingsEditor,
  onOpenSavingsField,
}: SettingsMoneyPersonalViewProps) {
  const { t } = useAppTranslation();

  return (
    <View style={styles.plainSavingsBlock}>
      {savingsCards.map((card) => {
        const palette = getSavingsTilePalette(card.key);
        const pots = savingsPotsByField[card.key];
        const hasSplitInvestmentPots = card.key === "investment" && pots.length > 0;
        const cardTitle = card.key === "emergency"
          ? t("settings.money.emergencyFunds")
          : card.key === "investment"
            ? t("settings.money.investments")
            : t("settings.money.savings");

        return (
          <View key={card.key} style={styles.moneySectionCard}>
            <View style={styles.savingsSectionStack}>
              <Text style={styles.savingsSectionTitle}>{cardTitle}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.savingsTilesRow} decelerationRate="fast" snapToInterval={tileSize + 12} snapToAlignment="start">
                {!hasSplitInvestmentPots ? (
                  <Pressable onPress={() => onOpenSavingsEditor(card.key)} style={[styles.savingsTileCard, { width: tileSize, height: tileSize, backgroundColor: palette.cardBg, borderColor: palette.borderColor }]}> 
                    <View style={styles.savingsTileTopRow}><View style={[styles.savingsTileIconWrap, { backgroundColor: palette.iconBg }]}><Ionicons name={card.icon} size={18} color={palette.valueColor} /></View></View>
                    <Text style={[styles.savingsTileValue, { color: palette.valueColor }]}>{currency}{asMoneyText(card.total)}</Text>
                    <Text style={[styles.savingsTileHint, { color: palette.hintColor }]}>{t("settings.money.baseAndMonthly", { base: `${currency}${asMoneyText(card.base)}`, monthly: `${currency}${asMoneyText(card.monthly)}` })}</Text>
                  </Pressable>
                ) : null}
                {pots.map((pot) => (
                  <Pressable key={pot.id} onPress={() => onOpenSavingsEditor(card.key, pot.id)} style={[styles.savingsTileCard, { width: tileSize, height: tileSize, backgroundColor: palette.cardBg, borderColor: palette.borderColor }]}> 
                    <View style={styles.savingsTileTopRow}><View style={[styles.savingsTileIconWrap, { backgroundColor: palette.iconBg }]}><Ionicons name={card.icon} size={18} color={palette.valueColor} /></View></View>
                    <Text style={[styles.savingsTileTitle, { color: palette.titleColor }]}>{pot.name}</Text>
                    <Text style={[styles.savingsTileValue, { color: palette.valueColor }]}>{currency}{asMoneyText(pot.amount)}</Text>
                  </Pressable>
                ))}
                {!hasSplitInvestmentPots ? (
                  <Pressable onPress={() => onOpenSavingsField(card.key)} style={[styles.savingsTileAddCard, { width: tileSize, height: tileSize, backgroundColor: palette.cardBg, borderColor: palette.borderColor }]} accessibilityLabel={t("settings.money.addMore", { label: cardTitle.toLowerCase() })}>
                    <Ionicons name="add" size={30} color={palette.plusColor} />
                    <Text style={[styles.savingsTileAddText, { color: palette.plusColor }]}>{getAddPotLabel(card.key)}</Text>
                  </Pressable>
                ) : null}
              </ScrollView>
            </View>
          </View>
        );
      })}
    </View>
  );
}

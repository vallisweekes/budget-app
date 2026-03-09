import React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

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
  return (
    <View style={styles.plainSavingsBlock}>
      {savingsCards.map((card) => (
        <View key={card.key} style={styles.moneySectionCard}>
          <View style={styles.savingsSectionStack}>
            <Text style={styles.savingsSectionTitle}>{card.title}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.savingsTilesRow} decelerationRate="fast" snapToInterval={tileSize + 12} snapToAlignment="start">
              {(() => {
                const palette = getSavingsTilePalette(card.key);
                return (
                  <Pressable onPress={() => onOpenSavingsEditor(card.key)} style={[styles.savingsTileCard, { width: tileSize, height: tileSize, backgroundColor: palette.cardBg, borderColor: palette.borderColor }]}>
                    <View style={styles.savingsTileTopRow}><View style={[styles.savingsTileIconWrap, { backgroundColor: palette.iconBg }]}><Ionicons name={card.icon} size={18} color={palette.valueColor} /></View></View>
                    <Text style={[styles.savingsTileValue, { color: palette.valueColor }]}>{currency}{asMoneyText(card.total)}</Text>
                    <Text style={[styles.savingsTileHint, { color: palette.hintColor }]}>Base {currency}{asMoneyText(card.base)} + monthly {currency}{asMoneyText(card.monthly)}</Text>
                  </Pressable>
                );
              })()}
              {savingsPotsByField[card.key].map((pot) => (
                <Pressable key={pot.id} onPress={() => onOpenSavingsEditor(card.key, pot.id)} style={[styles.savingsTileCard, { width: tileSize, height: tileSize, backgroundColor: getSavingsTilePalette(card.key).cardBg, borderColor: getSavingsTilePalette(card.key).borderColor }]}>
                  <View style={styles.savingsTileTopRow}><View style={[styles.savingsTileIconWrap, { backgroundColor: getSavingsTilePalette(card.key).iconBg }]}><Ionicons name={card.icon} size={18} color={getSavingsTilePalette(card.key).valueColor} /></View></View>
                  <Text style={[styles.savingsTileTitle, { color: getSavingsTilePalette(card.key).titleColor }]}>{pot.name}</Text>
                  <Text style={[styles.savingsTileValue, { color: getSavingsTilePalette(card.key).valueColor }]}>{currency}{asMoneyText(pot.amount)}</Text>
                </Pressable>
              ))}
              <Pressable onPress={() => onOpenSavingsField(card.key)} style={[styles.savingsTileAddCard, { width: tileSize, height: tileSize, backgroundColor: getSavingsTilePalette(card.key).cardBg, borderColor: getSavingsTilePalette(card.key).borderColor }]} accessibilityLabel={`Add more ${card.title.toLowerCase()}`}>
                <Ionicons name="add" size={30} color={getSavingsTilePalette(card.key).plusColor} />
                <Text style={[styles.savingsTileAddText, { color: getSavingsTilePalette(card.key).plusColor }]}>{getAddPotLabel(card.key)}</Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      ))}
    </View>
  );
}

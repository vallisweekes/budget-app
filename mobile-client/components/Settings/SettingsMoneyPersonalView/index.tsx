import React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useAppTranslation } from "@/hooks";
import { styles } from "./styles";

import type { SettingsMoneyPersonalViewProps } from "@/types/components/settings/SettingsMoneyPersonalView.types";

function normalizeBrokerName(value: string | null | undefined): string {
  const normalized = String(value ?? "").trim();
  return normalized || "none";
}

function aggregateInvestmentPotsByBroker(
  pots: SettingsMoneyPersonalViewProps["savingsPotsByField"]["investment"],
): SettingsMoneyPersonalViewProps["savingsPotsByField"]["investment"] {
  const groupedByKey = new Map<string, typeof pots[number]>();
  const orderedKeys: string[] = [];

  for (const pot of pots) {
    const broker = normalizeBrokerName(pot.broker);
    const shouldGroupByBroker = broker.toLowerCase() !== "none";
    const groupKey = shouldGroupByBroker ? `broker:${broker.toLowerCase()}` : `pot:${pot.id}`;
    const existing = groupedByKey.get(groupKey);

    if (!existing) {
      groupedByKey.set(groupKey, {
        ...pot,
        name: shouldGroupByBroker ? broker : pot.name,
        broker,
      });
      orderedKeys.push(groupKey);
      continue;
    }

    groupedByKey.set(groupKey, {
      ...existing,
      amount: Number(existing.amount) + Number(pot.amount),
    });
  }

  return orderedKeys
    .map((key) => groupedByKey.get(key))
    .filter((pot): pot is typeof pots[number] => Boolean(pot));
}

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
        const rawPots = savingsPotsByField[card.key];
        const pots = card.key === "investment"
          ? aggregateInvestmentPotsByBroker(rawPots)
          : rawPots;
        const hasSplitInvestmentPots = card.key === "investment" && pots.length > 0;
        const showAddTile = card.key === "investment" || !hasSplitInvestmentPots;
        const cardTitle = card.key === "emergency"
          ? t("settings.money.emergencyFunds")
          : card.key === "investment"
            ? t("settings.money.investments")
            : t("settings.money.savings");

        return (
          <View key={card.key} style={styles.moneySectionCard}>
            <View style={styles.savingsSectionStack}>
              <Text style={styles.savingsSectionTitle}>{cardTitle}</Text>
              <View style={styles.savingsTilesRowWrap}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.savingsTilesRow}
                  decelerationRate="fast"
                  snapToInterval={tileSize + 12}
                  snapToAlignment="start"
                  style={styles.savingsTilesScroller}
                >
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
                </ScrollView>

                {showAddTile ? (
                  <View style={styles.savingsFixedAddWrap}>
                    <Pressable
                      onPress={() => onOpenSavingsField(card.key)}
                      style={[
                        styles.savingsTileAddCircle,
                        {
                          backgroundColor: palette.cardBg,
                          borderColor: palette.borderColor,
                        },
                      ]}
                      accessibilityLabel={t("settings.money.addMore", { label: cardTitle.toLowerCase() })}
                      accessibilityHint={getAddPotLabel(card.key)}
                      hitSlop={8}
                    >
                      <Ionicons name="add" size={30} color={palette.plusColor} />
                    </Pressable>
                  </View>
                ) : null}
              </View>
            </View>
          </View>
        );
      })}
    </View>
  );
}

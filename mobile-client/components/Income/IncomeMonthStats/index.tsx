import React from "react";
import { Pressable, View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAppTranslation } from "@/hooks";
import { formatIncomePct } from "@/lib/domain/incomeStats";
import { T } from "@/lib/theme";
import { styles } from "./styles";
import type { IncomeMonthStatsProps } from "@/types";

export default function IncomeMonthStats({ data: a, currency, fmt, onPressIncomeSacrifice }: IncomeMonthStatsProps) {
  const { t } = useAppTranslation();
  const displayedMoneyLeft = Number(
    a.moneyLeftAfterPlan ?? a.spendableIncomeRightNow ?? a.incomeLeftRightNow ?? 0,
  );
  const incomeSacrificePctLabel =
    typeof a.incomeSacrificePct === "number"
      ? `${a.incomeSacrificePct.toFixed(1)}%`
      : formatIncomePct(a.incomeSacrifice, a.grossIncome);
  const moneyLeftPctLabel = formatIncomePct(displayedMoneyLeft, a.grossIncome);
  const isOnPlan = displayedMoneyLeft >= 0;
  const planStatusDescription = isOnPlan ? t("income.cards.onPlan") : t("income.cards.overPlan");

  return (
    <>
      {/* Top stat cards */}
      <View style={styles.row}>
        <Card label={t("income.cards.totalIncome")} value={fmt(a.grossIncome, currency)} color={T.green} iconName="sparkles-outline" />
        <Card
          label={t("income.cards.sacrifices")}
          value={fmt(a.incomeSacrifice, currency)}
          color={T.accent}
          subValue={incomeSacrificePctLabel}
          subColor={T.accent}
          onPress={onPressIncomeSacrifice}
          iconName="diamond-outline"
        />
      </View>

      {/* Secondary row */}
      <View style={styles.row}>
        {/* Money left with badge */}
        <View style={[styles.card, { flex: 1 }]}>
          <View style={[styles.cardGlow, { backgroundColor: `${displayedMoneyLeft < 0 ? T.red : T.green}16` }]} />
          <View style={styles.cardInnerBorder} />
          <View style={styles.cardHeaderStack}>
            <View style={styles.cardTitleWrap}>
              <View style={[styles.iconPill, { backgroundColor: `${displayedMoneyLeft < 0 ? T.red : T.green}14`, borderColor: `${displayedMoneyLeft < 0 ? T.red : T.green}33` }]}> 
                <Ionicons name="wallet-outline" size={14} color={displayedMoneyLeft < 0 ? T.red : T.green} />
              </View>
              <Text style={styles.cardLabel}>{t("income.cards.moneyLeft")}</Text>
            </View>
            <View style={[styles.badge, isOnPlan ? styles.badgeOn : styles.badgeOver]}>
              <Text style={[styles.badgeText, isOnPlan ? styles.badgeTextOn : styles.badgeTextOver]}>
                {planStatusDescription}
              </Text>
            </View>
          </View>
          <View style={styles.valueInline}>
            <Text style={[styles.cardValue, displayedMoneyLeft < 0 && styles.negative]}>
              {fmt(displayedMoneyLeft, currency)}
            </Text>
          </View>
          <Text style={[styles.cardSubline, displayedMoneyLeft < 0 ? styles.negative : styles.positive]}>
            {moneyLeftPctLabel}
          </Text>
        </View>
        <Card label={t("income.cards.leftToPay")} value={fmt(a.leftToPayRightNow, currency)} color={T.accent} iconName="receipt-outline" />
      </View>

    </>
  );
}

function Card({ label, value, color, subValue, subColor, onPress, iconName }: { label: string; value: string; color: string; subValue?: string; subColor?: string; onPress?: () => void; iconName: keyof typeof Ionicons.glyphMap }) {
  const content = (
    <>
      <View style={[styles.cardGlow, { backgroundColor: `${color}16` }]} />
      <View style={styles.cardInnerBorder} />
      <View style={styles.cardTitleWrap}>
        <View style={[styles.iconPill, { backgroundColor: `${color}14`, borderColor: `${color}33` }]}>
          <Ionicons name={iconName} size={14} color={color} />
        </View>
        <Text style={styles.cardLabel}>{label}</Text>
      </View>
      <View style={styles.valueInline}>
        <Text style={[styles.cardValue, { color }]}>{value}</Text>
        {subValue ? <Text style={[styles.cardPctInline, { color: subColor ?? T.textDim }]}>{subValue}</Text> : null}
      </View>
    </>
  );

  if (onPress) {
    return (
      <Pressable style={({ pressed }) => [styles.card, pressed && styles.cardPressed]} onPress={onPress} accessibilityRole="button" accessibilityLabel={label}>
        {content}
      </Pressable>
    );
  }

  return (
    <View style={styles.card}>{content}</View>
  );
}

import React from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { T } from "@/lib/theme";
import { styles } from "./styles";

import type { SettingsBudgetTabProps } from "@/types/components/settings/SettingsBudgetTab.types";

const STRATEGY_OPTIONS = [
  { value: "payYourselfFirst", label: "Pay Yourself First" },
  { value: "zeroBased", label: "Zero-based" },
  { value: "fiftyThirtyTwenty", label: "50/30/20" },
] as const;

export default function SettingsBudgetTab({
  payDate,
  horizonYears,
  payFrequencyLabel,
  billFrequencyLabel,
  strategyDraft,
  onOpenField,
  onOpenStrategy,
  onOpenIncomeSettings,
}: SettingsBudgetTabProps) {
  return (
    <View style={styles.plainBudgetBlock}>
      <Text style={styles.plainBudgetTitle}>Budget setup</Text>
      <View style={styles.twoColRow}>
        <Pressable onPress={() => onOpenField("payDate")} style={[styles.infoCard, styles.halfCard]}>
          <View style={styles.cardMiniActionRow}><View /><View style={styles.cardMiniIconBtn}><Ionicons name="pencil-outline" size={13} color={T.textDim} /></View></View>
          <Text style={styles.infoCardLabel}>Pay date</Text>
          <Text style={styles.infoCardValue}>Day {payDate ?? "-"}</Text>
        </Pressable>
        <Pressable onPress={() => onOpenField("horizon")} style={[styles.infoCard, styles.halfCard]}>
          <View style={styles.cardMiniActionRow}><View /><View style={styles.cardMiniIconBtn}><Ionicons name="pencil-outline" size={13} color={T.textDim} /></View></View>
          <Text style={styles.infoCardLabel}>Budget horizon</Text>
          <Text style={styles.infoCardValue}>{horizonYears} years</Text>
        </Pressable>
      </View>

      <View style={styles.twoColRow}>
        <Pressable onPress={() => onOpenField("payFrequency")} style={[styles.infoCard, styles.halfCard]}>
          <View style={styles.cardMiniActionRow}><View /><View style={styles.cardMiniIconBtn}><Ionicons name="pencil-outline" size={13} color={T.textDim} /></View></View>
          <Text style={styles.infoCardLabel}>Pay schedule</Text>
          <Text style={styles.infoCardValue}>{payFrequencyLabel}</Text>
        </Pressable>
        <Pressable onPress={() => onOpenField("billFrequency")} style={[styles.infoCard, styles.halfCard]}>
          <View style={styles.cardMiniActionRow}><View /><View style={styles.cardMiniIconBtn}><Ionicons name="pencil-outline" size={13} color={T.textDim} /></View></View>
          <Text style={styles.infoCardLabel}>Bill schedule</Text>
          <Text style={styles.infoCardValue}>{billFrequencyLabel}</Text>
        </Pressable>
      </View>

      <Pressable onPress={onOpenIncomeSettings} style={styles.infoCard}>
        <View style={styles.cardRowCenter}>
          <View style={{ flex: 1 }}>
            <Text style={styles.infoCardLabel}>Income settings</Text>
            <Text style={styles.infoCardValue}>Primary income setup</Text>
            <Text style={styles.infoCardHint}>Choose the income type your budget should mainly follow</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={T.textDim} />
        </View>
      </Pressable>

      <Pressable onPress={onOpenStrategy} style={styles.infoCard}>
        <View style={styles.cardRowCenter}>
          <View style={{ flex: 1 }}>
            <Text style={styles.infoCardLabel}>Strategy</Text>
            <Text style={styles.infoCardValue}>{STRATEGY_OPTIONS.find((s) => s.value === strategyDraft)?.label ?? "Pay Yourself First"}</Text>
            <Text style={styles.infoCardHint}>Tap to change strategy and view tips</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={T.textDim} />
        </View>
      </Pressable>
    </View>
  );
}

import React from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { STRATEGY_OPTIONS } from "@/lib/constants";
import { T } from "@/lib/theme";
import { styles } from "./styles";

import type { SettingsBudgetTabProps } from "@/types/components/settings/SettingsBudgetTab.types";

export default function SettingsBudgetTab({
  payDate,
  horizonYears,
  payFrequencyLabel,
  strategyDraft,
  onOpenField,
  onOpenStrategy,
  onOpenIncomeSettings,
}: SettingsBudgetTabProps) {
  return (
    <View style={styles.plainBudgetBlock}>
      <View style={styles.sectionHeaderRow}>
        <View style={styles.sectionBadge}>
          <Ionicons name="sparkles" size={12} color={T.accent} />
          <Text style={styles.sectionBadgeText}>Budget setup</Text>
        </View>
      </View>

      <View style={styles.twoColRow}>
        <Pressable onPress={() => onOpenField("payDate")} style={[styles.infoCard, styles.halfCard]}>
          <View pointerEvents="none" style={[styles.cardGlow, styles.cardGlowPrimary]} />
          <View pointerEvents="none" style={[styles.cardGlow, styles.cardGlowSecondary]} />
          <View style={styles.cardMiniActionRow}><View /><View style={styles.cardMiniIconBtn}><Ionicons name="pencil-outline" size={13} color={T.textDim} /></View></View>
          <View style={styles.infoLabelRow}>
            <Ionicons name="calendar-clear-outline" size={14} color={T.accent} />
            <Text style={styles.infoCardLabel}>Pay date</Text>
          </View>
          <Text style={styles.infoCardValue}>Day {payDate ?? "-"}</Text>
        </Pressable>
        <Pressable onPress={() => onOpenField("horizon")} style={[styles.infoCard, styles.halfCard]}>
          <View pointerEvents="none" style={[styles.cardGlow, styles.cardGlowPrimary]} />
          <View pointerEvents="none" style={[styles.cardGlow, styles.cardGlowSecondary]} />
          <View style={styles.cardMiniActionRow}><View /><View style={styles.cardMiniIconBtn}><Ionicons name="pencil-outline" size={13} color={T.textDim} /></View></View>
          <View style={styles.infoLabelRow}>
            <Ionicons name="time-outline" size={14} color={T.accent} />
            <Text style={styles.infoCardLabel}>Budget horizon</Text>
          </View>
          <Text style={styles.infoCardValue}>{horizonYears} years</Text>
        </Pressable>
      </View>

      <Pressable onPress={() => onOpenField("payFrequency")} style={styles.infoCard}>
        <View pointerEvents="none" style={[styles.cardGlow, styles.cardGlowPrimary]} />
        <View pointerEvents="none" style={[styles.cardGlow, styles.cardGlowSecondary]} />
        <View style={styles.cardMiniActionRow}><View /><View style={styles.cardMiniIconBtn}><Ionicons name="pencil-outline" size={13} color={T.textDim} /></View></View>
        <View style={styles.infoLabelRow}>
          <Ionicons name="repeat-outline" size={14} color={T.accent} />
          <Text style={styles.infoCardLabel}>Pay schedule</Text>
        </View>
        <Text style={styles.infoCardValue}>{payFrequencyLabel}</Text>
      </Pressable>

      <Pressable onPress={onOpenIncomeSettings} style={[styles.infoCard, styles.featureCard]}>
        <View pointerEvents="none" style={[styles.cardGlow, styles.featureGlowPrimary]} />
        <View pointerEvents="none" style={[styles.cardGlow, styles.featureGlowSecondary]} />
        <View style={styles.featureRow}>
          <View style={styles.featureIconWrap}>
            <Ionicons name="wallet-outline" size={17} color={T.accent} />
          </View>
          <View style={styles.featureTextWrap}>
            <Text style={styles.infoCardLabel}>Income settings</Text>
            <Text style={styles.infoCardValue}>Primary income setup</Text>
            <Text style={styles.infoCardHint}>Choose the income type your budget should mainly follow</Text>
          </View>
          <View style={styles.forwardBadge}>
            <Ionicons name="chevron-forward" size={17} color={T.text} />
          </View>
        </View>
      </Pressable>

      <Pressable onPress={onOpenStrategy} style={[styles.infoCard, styles.featureCard]}>
        <View pointerEvents="none" style={[styles.cardGlow, styles.featureGlowPrimary]} />
        <View pointerEvents="none" style={[styles.cardGlow, styles.featureGlowSecondary]} />
        <View style={styles.featureRow}>
          <View style={styles.featureIconWrap}>
            <Ionicons name="trending-up-outline" size={17} color={T.accent} />
          </View>
          <View style={styles.featureTextWrap}>
            <Text style={styles.infoCardLabel}>Strategy</Text>
            <Text style={styles.infoCardValue}>{STRATEGY_OPTIONS.find((s) => s.value === strategyDraft)?.label ?? "Pay Yourself First"}</Text>
            <Text style={styles.infoCardHint}>Tap to change strategy and view tips</Text>
          </View>
          <View style={styles.forwardBadge}>
            <Ionicons name="chevron-forward" size={17} color={T.text} />
          </View>
        </View>
      </Pressable>
    </View>
  );
}

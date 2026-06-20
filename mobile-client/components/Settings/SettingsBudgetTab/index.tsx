import React from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useAppTranslation } from "@/hooks";
import { T } from "@/lib/theme";
import { styles } from "./styles";

import type { SettingsBudgetTabProps } from "@/types/components/settings/SettingsBudgetTab.types";

export default function SettingsBudgetTab({
  payDate,
  horizonYears,
  payFrequencyLabel,
  debtManagementLabel,
  strategyDraft,
  onOpenField,
  onOpenStrategy,
  onOpenIncomeSettings,
  onOpenDebtManagement,
  onOpenPlans,
}: SettingsBudgetTabProps) {
  const { t } = useAppTranslation();
  const strategyLabel = strategyDraft === "zeroBased"
    ? t("settings.strategy.zeroBased")
    : strategyDraft === "fiftyThirtyTwenty"
      ? t("settings.strategy.fiftyThirtyTwenty")
      : t("settings.strategy.payYourselfFirst");

  return (
    <View style={styles.plainBudgetBlock}>
      <View style={styles.sectionHeaderRow}>
        <View style={styles.sectionBadge}>
          <Ionicons name="sparkles" size={12} color={T.accent} />
          <Text style={styles.sectionBadgeText}>{t("settings.budget.setupBadge")}</Text>
        </View>
      </View>

      <View style={styles.twoColRow}>
        <Pressable onPress={() => onOpenField("payDate")} style={[styles.infoCard, styles.halfCard]}>
          <View pointerEvents="none" style={[styles.cardGlow, styles.cardGlowPrimary]} />
          <View pointerEvents="none" style={[styles.cardGlow, styles.cardGlowSecondary]} />
          <View style={styles.cardMiniActionRow}><View /><View style={styles.cardMiniIconBtn}><Ionicons name="pencil-outline" size={13} color={T.textDim} /></View></View>
          <View style={styles.infoLabelRow}>
            <Ionicons name="calendar-clear-outline" size={14} color={T.accent} />
            <Text style={styles.infoCardLabel}>{t("settings.budget.payDate")}</Text>
          </View>
          <Text style={styles.infoCardValue}>{payDate ? t("settings.status.day", { day: payDate }) : "-"}</Text>
        </Pressable>
        <Pressable onPress={() => onOpenField("horizon")} style={[styles.infoCard, styles.halfCard]}>
          <View pointerEvents="none" style={[styles.cardGlow, styles.cardGlowPrimary]} />
          <View pointerEvents="none" style={[styles.cardGlow, styles.cardGlowSecondary]} />
          <View style={styles.cardMiniActionRow}><View /><View style={styles.cardMiniIconBtn}><Ionicons name="pencil-outline" size={13} color={T.textDim} /></View></View>
          <View style={styles.infoLabelRow}>
            <Ionicons name="time-outline" size={14} color={T.accent} />
            <Text style={styles.infoCardLabel}>{t("settings.budget.horizon")}</Text>
          </View>
          <Text style={styles.infoCardValue}>{t("settings.budget.years", { count: horizonYears })}</Text>
        </Pressable>
      </View>

      <Pressable onPress={() => onOpenField("payFrequency")} style={styles.infoCard}>
        <View pointerEvents="none" style={[styles.cardGlow, styles.cardGlowPrimary]} />
        <View pointerEvents="none" style={[styles.cardGlow, styles.cardGlowSecondary]} />
        <View style={styles.cardMiniActionRow}><View /><View style={styles.cardMiniIconBtn}><Ionicons name="pencil-outline" size={13} color={T.textDim} /></View></View>
        <View style={styles.infoLabelRow}>
          <Ionicons name="repeat-outline" size={14} color={T.accent} />
          <Text style={styles.infoCardLabel}>{t("settings.budget.paySchedule")}</Text>
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
            <Text style={styles.infoCardLabel}>{t("settings.budget.incomeSettings")}</Text>
            <Text style={styles.infoCardValue}>{t("settings.budget.primaryIncomeSetup")}</Text>
            <Text style={styles.infoCardHint}>{t("settings.budget.primaryIncomeHint")}</Text>
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
            <Text style={styles.infoCardLabel}>{t("settings.budget.strategy")}</Text>
            <Text style={styles.infoCardValue}>{strategyLabel}</Text>
            <Text style={styles.infoCardHint}>{t("settings.budget.strategyHint")}</Text>
          </View>
          <View style={styles.forwardBadge}>
            <Ionicons name="chevron-forward" size={17} color={T.text} />
          </View>
        </View>
      </Pressable>

      <Pressable onPress={onOpenDebtManagement} style={[styles.infoCard, styles.featureCard]}>
        <View pointerEvents="none" style={[styles.cardGlow, styles.featureGlowPrimary]} />
        <View pointerEvents="none" style={[styles.cardGlow, styles.featureGlowSecondary]} />
        <View style={styles.featureRow}>
          <View style={styles.featureIconWrap}>
            <Ionicons name="card-outline" size={17} color={T.accent} />
          </View>
          <View style={styles.featureTextWrap}>
            <Text style={styles.infoCardLabel}>{t("settings.overview.debtManagement")}</Text>
            <Text style={styles.infoCardValue}>{debtManagementLabel}</Text>
          </View>
          <View style={styles.forwardBadge}>
            <Ionicons name="chevron-forward" size={17} color={T.text} />
          </View>
        </View>
      </Pressable>

      <Pressable onPress={onOpenPlans} style={[styles.infoCard, styles.featureCard]}>
        <View pointerEvents="none" style={[styles.cardGlow, styles.featureGlowPrimary]} />
        <View pointerEvents="none" style={[styles.cardGlow, styles.featureGlowSecondary]} />
        <View style={styles.featureRow}>
          <View style={styles.featureIconWrap}>
            <Ionicons name="list-outline" size={17} color={T.accent} />
          </View>
          <View style={styles.featureTextWrap}>
            <Text style={styles.infoCardLabel}>{t("settings.overview.plans")}</Text>
            <Text style={styles.infoCardHint}>{t("settings.plansTitle")}</Text>
          </View>
          <View style={styles.forwardBadge}>
            <Ionicons name="chevron-forward" size={17} color={T.text} />
          </View>
        </View>
      </Pressable>
    </View>
  );
}

import React from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { fmt } from "@/lib/formatting";
import { useAppTranslation, useDebtScreenController } from "@/hooks";
import { T } from "@/lib/theme";
import AddDebtSheet from "@/components/DebtScreen/AddDebtSheet";
import DebtCard from "@/components/DebtScreen/DebtCard";
import DebtProjectionCard from "@/components/DebtScreen/DebtProjectionCard";
import LiabilityCard from "@/components/Debts/LiabilityCard";
import { debtStyles as styles } from "@/components/DebtScreen/style";

export default function DebtScreen() {
  const { t } = useAppTranslation();
  const controller = useDebtScreenController();

  if (controller.loading) {
    return (
      <SafeAreaView style={styles.safe} edges={[]}>
        <View style={[styles.center, { paddingTop: controller.topHeaderOffset }]}>
          <ActivityIndicator size="large" color={T.accent} />
        </View>
      </SafeAreaView>
    );
  }

  if (controller.error) {
    return (
      <SafeAreaView style={styles.safe} edges={[]}>
        <View style={[styles.center, { paddingTop: controller.topHeaderOffset }]}>
          <Ionicons name="cloud-offline-outline" size={48} color={T.textDim} />
          <Text style={styles.errorText}>{controller.error}</Text>
          <Pressable onPress={controller.onRetry} style={styles.retryBtn}>
            <Text style={styles.retryTxt}>{t("common.retry")}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={[]}>
      <FlatList
        ref={controller.listRef}
        data={controller.visibleDebts}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.scroll, { paddingTop: controller.topHeaderOffset }]}
        refreshControl={
          <RefreshControl refreshing={controller.refreshing} onRefresh={controller.onRefresh} tintColor={T.accent} />
        }
        ListHeaderComponent={
          <>
            <DebtProjectionCard controller={controller} />

            <View style={styles.heroRow}>
              <View style={[styles.heroCard, { borderColor: `${T.red}44` }]}>
                <View style={[styles.heroCardGlow, styles.heroCardGlowStart, { backgroundColor: `${T.red}20` }]} />
                <View style={[styles.heroCardGlow, styles.heroCardGlowEnd, { backgroundColor: `${T.red}14` }]} />
                <View style={styles.heroCardInnerBorder} />
                <Text style={styles.heroLabel}>{t("debts.hero.totalDebt")}</Text>
                <Text style={[styles.heroValue, { color: T.red }]}>{fmt(controller.projectionSummary.total, controller.currency)}</Text>
                <Text style={styles.heroSub}>
                  {controller.activeDebts.length === 1
                    ? t("debts.hero.activeDebtOne", { count: controller.activeDebts.length })
                    : t("debts.hero.activeDebtOther", { count: controller.activeDebts.length })}
                </Text>
              </View>
              <View style={[styles.heroCard, { borderColor: `${T.orange}44` }]}>
                <View style={[styles.heroCardGlow, styles.heroCardGlowStart, { backgroundColor: `${T.orange}1c` }]} />
                <View style={[styles.heroCardGlow, styles.heroCardGlowEnd, { backgroundColor: `${T.orange}12` }]} />
                <View style={styles.heroCardInnerBorder} />
                <Text style={styles.heroLabel}>{t("debts.hero.monthly")}</Text>
                <Text style={[styles.heroValue, { color: T.orange }]}>{fmt(controller.projectionSummary.monthly, controller.currency)}</Text>
                <Text style={styles.heroSub}>
                  {controller.projectionSummary.monthsToClear != null
                    ? t("debts.hero.monthsToClear", { count: controller.projectionSummary.monthsToClear })
                    : t("debts.projection.noPayoff")}
                </Text>
              </View>
            </View>

            <View style={styles.listHeader}>
              {controller.hasPaidOffDebts ? (
                <View style={styles.filterToggle}>
                  <Pressable
                    onPress={() => controller.setFilter("active")}
                    style={[styles.filterToggleOption, controller.filter === "active" && styles.filterToggleOptionActive]}
                  >
                    <Text style={[styles.filterToggleText, controller.filter === "active" && styles.filterToggleTextActive]}>{t("debts.filter.active")}</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => controller.setFilter("paid_off")}
                    style={[styles.filterToggleOption, controller.filter === "paid_off" && styles.filterToggleOptionActive]}
                  >
                    <Text style={[styles.filterToggleText, controller.filter === "paid_off" && styles.filterToggleTextActive]}>{t("debts.filter.paidOff")}</Text>
                  </Pressable>
                </View>
              ) : (
                <View style={styles.listHeaderSpacer} />
              )}
            </View>
          </>
        }
        renderItem={({ item }) => (
          <DebtCard debt={item} currency={controller.currency} onPress={() => controller.onPressDebt(item)} />
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="card-outline" size={52} color={T.iconMuted} />
            <Text style={styles.emptyTitle}>{controller.filter === "paid_off" ? t("debts.empty.noPaidOff") : t("debts.empty.noActive")}</Text>
            <Text style={styles.emptySubtitle}>
              {controller.filter === "paid_off"
                ? t("debts.empty.paidOffSub")
                : t("debts.empty.activeSub")}
            </Text>
          </View>
        }
        ListFooterComponent={
          <>
            {controller.liabilities.length > 0 ? (
              <View style={styles.liabilitiesSection}>
                <View style={styles.liabilitiesHeader}>
                  <Text style={styles.liabilitiesHeading}>
                    {controller.filter === "paid_off" ? "PAID OFF LIABILITIES" : "LIABILITIES"}
                  </Text>
                  <Text style={styles.liabilitiesSubheading}>
                    {controller.filter === "paid_off"
                      ? `${controller.liabilities.length} paid off`
                      : `${fmt(controller.totalLiabilityBalance, controller.currency)} outstanding`}
                  </Text>
                </View>
                {controller.liabilities.map((item) => (
                  <LiabilityCard
                    key={item.id}
                    item={item}
                    currency={controller.currency}
                    onPress={controller.onPressDebt}
                  />
                ))}
              </View>
            ) : null}

            {(controller.summary?.tips ?? []).length > 0 ? (
              <View style={styles.tipsCard}>
                <View style={styles.tipsHeader}>
                  <Ionicons name="bulb-outline" size={15} color={T.orange} />
                  <Text style={styles.tipsHeading}>{t("debts.tipsHeading")}</Text>
                </View>
                {controller.summary?.tips.map((tip, index) => (
                  <View key={`${tip.title}-${index}`} style={[styles.tipRow, index > 0 && styles.tipBorder]}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.tipTitle}>{tip.title}</Text>
                      <Text style={styles.tipDetail}>{tip.detail}</Text>
                    </View>
                  </View>
                ))}
              </View>
            ) : null}
          </>
        }
      />

      <AddDebtSheet controller={controller} />
    </SafeAreaView>
  );
}
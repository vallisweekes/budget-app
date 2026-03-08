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
import { useDebtScreenController } from "@/lib/hooks/useDebtScreenController";
import { T } from "@/lib/theme";
import AddDebtSheet from "@/screens/debt/AddDebtSheet";
import DebtCard from "@/screens/debt/DebtCard";
import DebtProjectionCard from "@/screens/debt/DebtProjectionCard";
import { debtStyles as styles } from "@/screens/debt/styles";

export default function DebtScreen() {
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
            <Text style={styles.retryTxt}>Retry</Text>
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
            <View style={styles.heroRow}>
              <View style={[styles.heroCard, { borderColor: `${T.red}44` }]}>
                <Text style={styles.heroLabel}>TOTAL DEBT</Text>
                <Text style={[styles.heroValue, { color: T.red }]}>{fmt(controller.projectionSummary.total, controller.currency)}</Text>
                <Text style={styles.heroSub}>
                  {controller.activeDebts.length} active {controller.activeDebts.length === 1 ? "debt" : "debts"}
                </Text>
              </View>
              <View style={[styles.heroCard, { borderColor: `${T.orange}44` }]}>
                <Text style={styles.heroLabel}>MONTHLY</Text>
                <Text style={[styles.heroValue, { color: T.orange }]}>{fmt(controller.projectionSummary.monthly, controller.currency)}</Text>
                <Text style={styles.heroSub}>
                  {controller.projectionSummary.monthsToClear != null
                    ? `~${controller.projectionSummary.monthsToClear} mo to clear`
                    : "No payoff projected"}
                </Text>
              </View>
            </View>

            <DebtProjectionCard controller={controller} />

            <View style={styles.listHeader}>
              {controller.hasPaidOffDebts ? (
                <View style={styles.filterToggle}>
                  <Pressable
                    onPress={() => controller.setFilter("active")}
                    style={[styles.filterToggleOption, controller.filter === "active" && styles.filterToggleOptionActive]}
                  >
                    <Text style={[styles.filterToggleText, controller.filter === "active" && styles.filterToggleTextActive]}>Active</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => controller.setFilter("paid_off")}
                    style={[styles.filterToggleOption, controller.filter === "paid_off" && styles.filterToggleOptionActive]}
                  >
                    <Text style={[styles.filterToggleText, controller.filter === "paid_off" && styles.filterToggleTextActive]}>Paid Off</Text>
                  </Pressable>
                </View>
              ) : (
                <View style={styles.listHeaderSpacer} />
              )}

              <Pressable onPress={controller.onOpenAddForm} style={styles.addBtn}>
                <Ionicons name="add" size={18} color={T.onAccent} />
                <Text style={styles.addBtnTxt}>Debt</Text>
              </Pressable>
            </View>
          </>
        }
        renderItem={({ item }) => (
          <DebtCard debt={item} currency={controller.currency} onPress={() => controller.onPressDebt(item)} />
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="card-outline" size={52} color={T.iconMuted} />
            <Text style={styles.emptyTitle}>{controller.filter === "paid_off" ? "No paid off debts" : "No active debts"}</Text>
            <Text style={styles.emptySubtitle}>
              {controller.filter === "paid_off"
                ? "Paid debts will appear here once they are cleared."
                : 'Tap "Add Debt" to track a debt'}
            </Text>
          </View>
        }
        ListFooterComponent={
          (controller.summary?.tips ?? []).length > 0 ? (
            <View style={styles.tipsCard}>
              <View style={styles.tipsHeader}>
                <Ionicons name="bulb-outline" size={15} color={T.orange} />
                <Text style={styles.tipsHeading}>Tips</Text>
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
          ) : null
        }
      />

      <AddDebtSheet controller={controller} />
    </SafeAreaView>
  );
}
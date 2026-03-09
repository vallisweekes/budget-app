/**
 * ExpensesScreen
 *
 * All financial calculations (totals, paid/unpaid, category breakdown) are
 * computed server-side via /api/bff/expenses/summary so this screen shares
 * the exact same logic as the web client — no client-side arithmetic.
 *
 * Currency comes from /api/bff/settings (never hardcoded).
 * Upcoming payments come from /api/bff/expense-insights.
 */

import React, { useRef } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useScrollToTop } from "@react-navigation/native";

import AddExpenseSheet from "@/components/Expenses/AddExpenseSheet";
import CategoryBreakdown from "@/components/Expenses/CategoryBreakdown";
import { MONTH_NAMES_SHORT } from "@/lib/constants";
import { fmt } from "@/lib/formatting";
import { useExpensesScreenController } from "@/hooks";
import { T } from "@/lib/theme";
import { expensesStyles as styles } from "@/components/ExpensesScreen/style";
import type { ExpensesScreenProps } from "@/types";

export default function ExpensesScreen({ navigation, route }: ExpensesScreenProps) {
  const listRef = useRef<FlatList<never>>(null);
  useScrollToTop(listRef);

  const controller = useExpensesScreenController({ navigation, route });

  return (
    <SafeAreaView style={styles.safe} edges={[]}>
      {controller.loadingUi ? (
        <View style={[styles.center, { paddingTop: controller.topHeaderOffset }]}>
          <ActivityIndicator size="large" color={T.accent} />
        </View>
      ) : controller.error ? (
        <View style={[styles.center, { paddingTop: controller.topHeaderOffset }]}>
          <Ionicons name="cloud-offline-outline" size={40} color={T.textDim} />
          <Text style={styles.errorText}>{controller.error}</Text>
          <Pressable onPress={controller.onRetry} style={styles.retryBtn}>
            <Text style={styles.retryTxt}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={[]}
          keyExtractor={() => ""}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={controller.refreshing}
              onRefresh={controller.onRefresh}
              tintColor={T.accent}
            />
          }
          ListHeaderComponent={
            <>
              <View style={[styles.purpleHero, { paddingTop: controller.topHeaderOffset + 22 }]}>
                {controller.showPlanTotalFallback ? (
                  <Text style={styles.purpleHeroLabel}>
                    Total {controller.activePlan?.name ?? "Plan"} expenses
                  </Text>
                ) : (
                  <Pressable onPress={controller.onOpenMonthPicker} style={styles.purpleHeroLabelBtn} hitSlop={12}>
                    <Text style={styles.purpleHeroLabel}>{controller.selectedPeriodRange}</Text>
                    <Ionicons name="chevron-down" size={14} color="rgba(255,255,255,0.72)" />
                  </Pressable>
                )}
                {controller.summary ? (
                  <>
                    <Text style={styles.purpleHeroAmount}>
                      {fmt(
                        controller.showPlanTotalFallback ? controller.planTotalAmount : (controller.summary.totalAmount ?? 0),
                        controller.currency,
                      )}
                    </Text>
                    {!controller.showPlanTotalFallback && (
                      <Text style={styles.purpleHeroMeta}>
                        {`${controller.summary.totalCount ?? 0} bill${(controller.summary.totalCount ?? 0) === 1 ? "" : "s"}`}
                      </Text>
                    )}
                    {(() => {
                      if (controller.showPlanTotalFallback) return null;
                      const currentTotal = controller.summary.totalAmount ?? 0;
                      const previousTotal = controller.previousSummary?.totalAmount ?? 0;
                      if (previousTotal <= 0) return null;
                      const changePct = ((currentTotal - previousTotal) / previousTotal) * 100;
                      const increase = changePct >= 0;
                      const pctLabel = `${increase ? "↗" : "↘"} ${Math.abs(changePct).toFixed(1)}%`;
                      return (
                        <View style={styles.purpleHeroDeltaRow}>
                          <Text style={[styles.purpleHeroDeltaPct, increase ? styles.purpleDeltaUp : styles.purpleDeltaDown]}>
                            {pctLabel}
                          </Text>
                          <Text style={styles.purpleHeroDeltaText}> vs last month</Text>
                        </View>
                      );
                    })()}
                  </>
                ) : null}
              </View>

              {controller.showTopAddExpenseCta && controller.isPersonalPlan ? (
                <View style={styles.noExpensesCard}>
                  <View style={styles.noExpensesCardRow}>
                    <View style={styles.noExpensesCardCopy}>
                      <Text style={styles.noExpensesTitle}>No expense for this period</Text>
                      <Text style={styles.noExpensesSub}>{controller.selectedPeriodRange}</Text>
                      <Text style={styles.noExpensesHint}>Tap + Expense to create your first expense.</Text>
                    </View>
                    <Pressable onPress={controller.onOpenAddSheet} style={styles.noExpensesAddBtn}>
                      <Ionicons name="add" size={18} color={T.onAccent} />
                      <Text style={styles.noExpensesAddBtnTxt}>Expense</Text>
                    </Pressable>
                  </View>
                </View>
              ) : null}

              {controller.plans.length > 1 && (
                <View style={styles.planCardsWrap} {...controller.planSwipeHandlers}>
                  <View style={styles.planTabsBg}>
                    <ScrollView
                      ref={controller.planScrollRef}
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.planTabsScroll}
                      onLayout={(event) => {
                        controller.onPlanTabsLayout(event.nativeEvent.layout.width);
                      }}
                    >
                      {controller.plans.map((plan) => {
                        const selected = controller.selectedPlanTabId === plan.id;
                        return (
                          <Pressable
                            key={plan.id}
                            onPress={() => controller.onPressPlan(plan.id)}
                            onLayout={(event) => {
                              controller.onPlanItemLayout(
                                plan.id,
                                event.nativeEvent.layout.x,
                                event.nativeEvent.layout.width,
                                selected,
                              );
                            }}
                            style={[styles.planPill, selected && styles.planPillSelected]}
                            hitSlop={8}
                          >
                            <Text style={[styles.planPillText, selected && styles.planPillTextSelected]} numberOfLines={1}>
                              {plan.name}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </ScrollView>
                  </View>
                </View>
              )}

              {!controller.isPersonalPlan && controller.plans.length > 1 && (controller.summary?.totalCount ?? 0) === 0 && (
                <View style={styles.noExpensesCard}>
                  <View style={styles.noExpensesCardRow}>
                    <View style={styles.noExpensesCardCopy}>
                      <Text style={styles.noExpensesTitle}>No expense for this period</Text>
                      <Text style={styles.noExpensesSub}>{controller.selectedPeriodRange}</Text>
                      <Text style={styles.noExpensesHint}>Tap + Expense to create your first expense.</Text>
                    </View>
                    <Pressable onPress={controller.onOpenAddSheet} style={styles.noExpensesAddBtn}>
                      <Ionicons name="add" size={18} color={T.onAccent} />
                      <Text style={styles.noExpensesAddBtnTxt}>Expense</Text>
                    </Pressable>
                  </View>
                </View>
              )}

              {controller.summary && (
                <CategoryBreakdown
                  categories={controller.summary.categoryBreakdown}
                  currency={controller.currency}
                  fmt={fmt}
                  onCategoryPress={controller.onPressCategory}
                  onAddPress={controller.onOpenAddSheet}
                />
              )}

              {!controller.isPersonalPlan && controller.plans.length > 1 && controller.expenseMonths.length > 0 && (
                <>
                  <View style={styles.sectionHeadingWrap}>
                    <Text style={styles.sectionHeading}>Upcoming Months Expenses</Text>
                  </View>
                  <View style={styles.monthCardsWrap}>
                    {controller.expenseMonths
                      .filter((item) => !(item.month === controller.month && item.year === controller.year))
                      .map((item) => (
                        <Pressable
                          key={`${item.year}-${item.month}`}
                          onPress={() => controller.onPressUpcomingMonth(item.month, item.year)}
                          style={styles.monthCard}
                        >
                          <View style={styles.monthCardRow}>
                            <Text style={styles.monthCardTitle}>{MONTH_NAMES_SHORT[item.month - 1]} {item.year}</Text>
                            <Text style={styles.monthCardAmount}>{fmt(item.totalAmount ?? 0, controller.currency)}</Text>
                          </View>
                          <Text style={styles.monthCardMeta}>{item.totalCount} expense{item.totalCount === 1 ? "" : "s"}</Text>
                        </Pressable>
                      ))}
                  </View>
                </>
              )}
            </>
          }
          renderItem={() => null}
        />
      )}

      <AddExpenseSheet
        visible={controller.addSheetOpen}
        month={controller.month}
        year={controller.year}
        budgetPlanId={controller.selectedPlanTabId}
        plans={controller.plans}
        currency={controller.currency}
        categories={controller.categoriesForAddSheet}
        onAdded={controller.onAddComplete}
        onClose={controller.closeAddSheet}
      />

      <Modal
        visible={controller.monthPickerOpen}
        transparent
        animationType="slide"
        onRequestClose={controller.closeMonthPicker}
      >
        <View style={styles.pickerOverlay}>
          <Pressable style={styles.pickerBackdrop} onPress={controller.closeMonthPicker} />
          <View style={styles.pickerSheet}>
            <View style={styles.pickerHandle} />
            <View style={styles.pickerYearRow}>
              <Pressable
                onPress={() => controller.setPickerYear((value) => value - 1)}
                hitSlop={12}
                style={styles.pickerYearBtn}
              >
                <Ionicons name="chevron-back" size={22} color={T.text} />
              </Pressable>
              <Text style={styles.pickerYearText}>{controller.pickerYear}</Text>
              <Pressable
                onPress={() => controller.setPickerYear((value) => value + 1)}
                hitSlop={12}
                style={styles.pickerYearBtn}
              >
                <Ionicons name="chevron-forward" size={22} color={T.text} />
              </Pressable>
            </View>
            <View style={styles.pickerGrid}>
              {controller.allPeriodMonths.map((item) => {
                const isEnabled = controller.enabledPeriodSet.has(item);
                const isSelected = item === controller.month && controller.pickerYear === controller.year;
                const periodLabel = `${MONTH_NAMES_SHORT[(item + 10) % 12]} - ${MONTH_NAMES_SHORT[(item + 11) % 12]}`;
                return (
                  <Pressable
                    key={item}
                    disabled={!isEnabled}
                    onPress={() => controller.onSelectPickerMonth(item)}
                    style={[
                      styles.pickerCell,
                      !isEnabled && styles.pickerCellDisabled,
                      isSelected && styles.pickerCellSelected,
                    ]}
                  >
                    <Text
                      style={[
                        styles.pickerCellText,
                        !isEnabled && styles.pickerCellDisabledText,
                        isSelected && styles.pickerCellSelectedText,
                      ]}
                    >
                      {periodLabel}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
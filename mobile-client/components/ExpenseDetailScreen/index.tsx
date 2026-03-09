import React from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Circle, Polyline } from "react-native-svg";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import PaymentSheet from "@/components/Debts/Detail/PaymentSheet";
import EditExpenseSheet from "@/components/Expenses/EditExpenseSheet";
import DeleteConfirmSheet from "@/components/Shared/DeleteConfirmSheet";
import { fmt } from "@/lib/formatting";
import { useExpenseDetailScreenController } from "@/hooks";
import { T } from "@/lib/theme";
import { expenseDetailStyles as styles, EXPENSE_HERO_BLUE } from "@/components/ExpenseDetailScreen/style";
import { statusLabel } from "@/components/ExpenseDetailScreen/utils";
import type { ExpenseDetailScreenProps } from "@/types";

export default function ExpenseDetailScreen({ route, navigation }: ExpenseDetailScreenProps) {
  const controller = useExpenseDetailScreenController({ route, navigation });

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <View style={[styles.header, { paddingTop: controller.insetsTop + 8 }]}> 
        <BlurView intensity={14} tint="dark" style={StyleSheet.absoluteFillObject} pointerEvents="none" />
        <View style={styles.headerGlassTint} pointerEvents="none" />
        <Pressable onPress={controller.onGoBack} style={styles.backBtn} hitSlop={10}>
          <Ionicons name="chevron-back" size={24} color="#ffffff" />
        </Pressable>
      </View>

      {controller.showSkeleton ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={T.accent} />
        </View>
      ) : controller.showRetryState ? (
        <View style={styles.center}>
          <Ionicons name="cloud-offline-outline" size={48} color={T.textDim} />
          <Text style={styles.errorText}>{controller.error ?? "Expense not found"}</Text>
          <Pressable onPress={controller.onRetry} style={styles.retryBtn}>
            <Text style={styles.retryTxt}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <ScrollView
            style={{ backgroundColor: EXPENSE_HERO_BLUE }}
            contentContainerStyle={[
              styles.scroll,
              { paddingTop: controller.insetsTop + 64, paddingBottom: 120 + controller.tabBarHeight + 12 },
            ]}
            refreshControl={
              <RefreshControl
                refreshing={controller.refreshing}
                onRefresh={controller.onRefresh}
                tintColor={T.accent}
              />
            }
          >
            <View style={styles.hero}>
              <View style={styles.brandCircle}>
                {controller.showLogo ? (
                  <Image
                    source={{ uri: controller.logoUri as string }}
                    style={styles.brandLogo}
                    resizeMode="contain"
                    onError={controller.onLogoError}
                  />
                ) : (
                  <Text style={styles.brandLetter}>{(controller.displayName.trim()?.[0] ?? "?").toUpperCase()}</Text>
                )}
              </View>

              <Text style={styles.heroName} numberOfLines={2}>{controller.displayName}</Text>
              <Text style={styles.heroAmount}>{fmt(controller.amountNum, controller.currency)}</Text>
              <Text style={styles.heroUpdated}>Updated: {controller.updatedLabel}</Text>

              {!controller.isPaid ? (
                <View
                  style={[
                    styles.heroDueBadge,
                    {
                      borderColor: `${controller.dueDateBadgeColor}66`,
                      backgroundColor: `${controller.dueDateBadgeColor}22`,
                    },
                  ]}
                >
                  <Ionicons name="calendar-outline" size={14} color="#ffffff" />
                  <Text style={styles.heroDueTxt}>{controller.dueDateLabel}</Text>
                </View>
              ) : null}

              <View style={styles.heroCards}>
                <View style={styles.heroCard}>
                  <Text style={styles.heroCardLbl}>Paid</Text>
                  <Text style={[styles.heroCardVal, { color: T.green }]}>{fmt(controller.paidNum, controller.currency)}</Text>
                </View>
                <View style={styles.heroCard}>
                  <Text style={styles.heroCardLbl}>Remaining</Text>
                  <Text style={[styles.heroCardVal, { color: T.orange }]}>{fmt(controller.remainingNum, controller.currency)}</Text>
                </View>
              </View>

              {controller.shouldShowStatusGraceNote ? <Text style={styles.statusGraceNote}>{controller.statusGraceNote}</Text> : null}

              {controller.showQuickActions ? (
                <View style={[styles.quickRow, controller.compactQuickRow && { marginTop: 18 }, controller.isPaid && { marginTop: 10 }]}>
                  {!controller.isPaid ? (
                    <>
                      <Pressable
                        style={[styles.quickBtn, styles.quickBtnPrimary, controller.paying && styles.quickDisabled]}
                        onPress={controller.onMarkPaid}
                        disabled={controller.paying}
                      >
                        <Text style={styles.quickPrimaryTxt}>Mark as paid</Text>
                      </Pressable>
                      <Pressable
                        style={[styles.quickBtn, styles.quickBtnSecondary, controller.paying && styles.quickDisabled]}
                        onPress={controller.onOpenRecordPayment}
                        disabled={controller.paying}
                      >
                        <Text style={styles.quickSecondaryTxt}>Record payment</Text>
                      </Pressable>
                    </>
                  ) : controller.canEditPaidPayment ? (
                    <Pressable
                      style={[styles.quickBtn, styles.quickBtnSecondary, controller.paying && styles.quickDisabled]}
                      onPress={controller.onOpenUnpaidConfirm}
                      disabled={controller.paying}
                    >
                      <Text style={styles.quickSecondaryTxt}>Mark as unpaid</Text>
                    </Pressable>
                  ) : null}
                </View>
              ) : null}

              {controller.lockedHintVisible ? (
                <Text style={styles.lockedHint}>Payment changes are locked after {controller.paymentEditGraceDays} days.</Text>
              ) : null}
            </View>

            {controller.shouldShowFrequencyCard ? (
              <View style={styles.freqCard}>
                <View style={styles.freqHeadRow}>
                  <Text style={styles.freqTitle}>Payment frequency</Text>
                  <View style={styles.freqHeadRight}>
                    {controller.freqIndicator ? (
                      <Text style={[styles.freqIndicatorTxt, { color: controller.freqIndicator.color }]}>{controller.freqIndicator.label}</Text>
                    ) : null}
                    {controller.frequencyLoading ? <ActivityIndicator size="small" color={T.accent} /> : null}
                  </View>
                </View>
                <Text style={styles.freqSub}>
                  {controller.hasFrequencyHistory ? controller.freqDisplay.subtitle : controller.frequencyLoading ? "Checking history..." : "No history yet"}
                </Text>

                {controller.frequencyLoading ? (
                  <View style={styles.freqEmptyState}>
                    <ActivityIndicator size="small" color={T.accent} />
                    <Text style={styles.freqEmptyText}>Checking payment history...</Text>
                  </View>
                ) : controller.hasFrequencyHistory ? (
                  <View style={styles.sparkWrap}>
                    <Svg width={controller.spark.w} height={controller.spark.h}>
                      {controller.spark.lastKnownIndex >= 1 ? (
                        <Polyline
                          points={controller.spark.polylinePoints}
                          fill="none"
                          stroke={T.accent}
                          strokeWidth={2.5}
                          strokeLinejoin="round"
                          strokeLinecap="round"
                        />
                      ) : null}

                      {controller.freqDisplay.points.map((point, index) => {
                        const { x, y } = controller.spark.toXY(index);
                        const ratio = Math.max(0, Math.min(1, Number(point.ratio) || 0));
                        const dot = (() => {
                          switch (point.status) {
                            case "paid":
                              return { fill: T.green, stroke: "rgba(255,255,255,0.55)" };
                            case "partial":
                              return { fill: T.orange, stroke: "rgba(255,255,255,0.55)" };
                            case "unpaid":
                              return { fill: T.red, stroke: "rgba(255,255,255,0.55)" };
                            case "missed":
                              return { fill: "rgba(255,255,255,0.06)", stroke: T.red };
                            case "upcoming":
                              return { fill: T.border, stroke: "rgba(255,255,255,0.18)" };
                            default:
                              return { fill: point.present ? (ratio >= 0.999 ? T.green : ratio > 0 ? T.orange : T.red) : T.border, stroke: "rgba(255,255,255,0.18)" };
                          }
                        })();
                        return (
                          <Circle
                            key={point.key}
                            cx={x}
                            cy={y}
                            r={point.present ? 4 : point.status === "missed" ? 3.75 : 3.5}
                            fill={dot.fill}
                            stroke={dot.stroke}
                            strokeWidth={1.5}
                          />
                        );
                      })}
                    </Svg>

                    <View style={styles.sparkLabels}>
                      {controller.freqDisplay.points.map((point) => (
                        <Text key={`${point.key}-lbl`} style={styles.sparkLbl}>{point.label}</Text>
                      ))}
                    </View>

                    <View style={styles.sparkStatuses}>
                      {controller.freqDisplay.points.map((point) => {
                        const color = point.status === "paid"
                          ? T.green
                          : point.status === "partial"
                            ? T.orange
                            : point.status === "unpaid" || point.status === "missed"
                              ? T.red
                              : T.textMuted;
                        return (
                          <Text key={`${point.key}-st`} style={[styles.sparkStatus, { color }]}> 
                            {statusLabel(point.status)}
                          </Text>
                        );
                      })}
                    </View>
                  </View>
                ) : (
                  <View style={styles.freqEmptyState}>
                    <Text style={styles.freqEmptyText}>No history yet — once this expense appears in another month, frequency will show here.</Text>
                  </View>
                )}
              </View>
            ) : null}

            <View style={styles.aiCard}>
              <View style={styles.aiTitleRow}>
                <Ionicons name="bulb-outline" size={16} color={T.orange} />
                <Text style={styles.aiTitle}>AI tips</Text>
              </View>
              <Text style={styles.aiText}>{controller.tips[Math.max(0, Math.min(controller.tips.length - 1, controller.tipIndex))] ?? ""}</Text>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      )}

      {controller.showBottomActions ? (
        <View style={[styles.bottomActionsWrap, { paddingBottom: controller.tabBarHeight + 8 }]}> 
          <BlurView intensity={14} tint="dark" style={StyleSheet.absoluteFillObject} pointerEvents="none" />
          <View style={styles.bottomGlassTint} pointerEvents="none" />
          <View style={styles.bottomActionsRow}>
            <Pressable style={styles.bottomActionBtn} onPress={controller.onOpenEditSheet}>
              <Text style={[styles.bottomActionTxt, { color: EXPENSE_HERO_BLUE }]}>Edit</Text>
            </Pressable>
            <Pressable style={styles.bottomActionBtn} onPress={controller.onOpenDeleteConfirm}>
              <Text style={[styles.bottomActionTxt, { color: T.red }]}>Delete</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      <PaymentSheet
        visible={controller.paySheetOpen}
        currency={controller.currency}
        payAmount={controller.payAmount}
        paying={controller.paying}
        onChangeAmount={controller.onChangePayAmount}
        onClose={controller.onClosePaymentSheet}
        onSave={controller.onSavePayment}
        onMarkPaid={controller.onMarkPaid}
        showMarkPaid={false}
      />

      <EditExpenseSheet
        visible={controller.editSheetOpen}
        expense={controller.expense}
        budgetPlanId={route.params.budgetPlanId}
        currency={controller.currency}
        periodSpanLabel={controller.editPeriodContext.span}
        periodRangeLabel={controller.editPeriodContext.range}
        onClose={controller.onCloseEditSheet}
        onSaved={controller.onSaveEdit}
      />

      <DeleteConfirmSheet
        visible={controller.unpaidConfirmOpen}
        title="Mark as unpaid?"
        description={controller.unpaidWarningText}
        confirmText="Unpaid"
        cancelText="Cancel"
        isBusy={controller.paying}
        onClose={controller.onCloseUnpaidConfirm}
        onConfirm={controller.onConfirmUnpaid}
      />

      <DeleteConfirmSheet
        visible={controller.deleteConfirmOpen}
        title="Delete Expense"
        description={`Are you sure you want to delete "${controller.expense?.name ?? controller.expenseName}"? This cannot be undone.`}
        isBusy={controller.deleting}
        onClose={controller.onCloseDeleteConfirm}
        onConfirm={controller.onConfirmDelete}
      />
    </SafeAreaView>
  );
}
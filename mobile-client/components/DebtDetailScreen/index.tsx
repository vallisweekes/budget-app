import React from "react";
import { ActivityIndicator, Image, KeyboardAvoidingView, Platform, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { BlurView } from "expo-blur";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useNavigation, useRoute } from "@react-navigation/native";

import { s } from "@/components/DebtDetailScreen/style";
import type { DebtDetailNav, DebtDetailRoute } from "@/types";
import { buildProjection, derivePayoffSummary } from "@/lib/domain/debtPayoff";
import { getApiBaseUrl } from "@/lib/api";
import { T } from "@/lib/theme";
import { fmt } from "@/lib/formatting";
import DeleteConfirmSheet from "@/components/Shared/DeleteConfirmSheet";
import DebtDetailHeader from "@/components/Debts/Detail/DebtDetailHeader";
import DebtStatsGrid from "@/components/Debts/Detail/DebtStatsGrid";
import PayoffChart from "@/components/Debts/Detail/PayoffChart";
import PaymentSheet from "@/components/Debts/Detail/PaymentSheet";
import EditDebtSheet from "@/components/Debts/Detail/EditDebtSheet";
import PaymentHistorySection from "@/components/Debts/Detail/PaymentHistorySection";
import { useDebtDetailController } from "@/hooks";

function resolveLogoUri(raw: string | null | undefined): string | null {
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  if (!raw.startsWith("/")) return null;

  try {
    return `${getApiBaseUrl()}${raw}`;
  } catch {
    return null;
  }
}

export default function DebtDetailScreen() {
  const navigation = useNavigation<DebtDetailNav>();
  const { params } = useRoute<DebtDetailRoute>();
  const { debtId, debtName } = params;
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = React.useState<"details" | "payments">("details");

  const state = useDebtDetailController({
    debtId,
    debtName,
    onDeleted: (deletedDebtId) =>
      navigation.navigate("DebtList", { optimisticDeletedDebtId: deletedDebtId }),
    onDeleteFailed: (failedDebtId) =>
      navigation.navigate("DebtList", { restoreDebtId: failedDebtId }),
  });
  const { debt, loading, error, currency, derived } = state;

  React.useEffect(() => {
    setActiveTab("details");
  }, [debtId]);

  useFocusEffect(
    React.useCallback(() => {
      state.load();
    }, [state.load])
  );

  if (loading) {
    return (
      <SafeAreaView style={s.safe} edges={["bottom"]}>
        <DebtDetailHeader title={debtName} editing={false} hideActions onBack={() => navigation.goBack()} onToggleEdit={() => {}} onDelete={() => {}} />
        <View style={s.center}><ActivityIndicator size="large" color={T.accent} /></View>
      </SafeAreaView>
    );
  }

  if (error || !debt) {
    return (
      <SafeAreaView style={s.safe} edges={["bottom"]}>
        <DebtDetailHeader title={debtName} editing={false} hideActions onBack={() => navigation.goBack()} onToggleEdit={() => {}} onDelete={() => {}} />
        <View style={s.center}>
          <Ionicons name="cloud-offline-outline" size={48} color={T.textDim} />
          <Text style={s.errorText}>{error ?? "Debt not found"}</Text>
          <Pressable onPress={() => { void state.load(); }} style={s.retryBtn}><Text style={s.retryTxt}>Retry</Text></Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const monthlyPaymentNum = derived.dueTarget;
  const hasCurrentPeriodPaymentOverride =
    debt.dueThisMonth != null &&
    debt.computedMonthlyPayment != null &&
    Math.abs(Number(debt.dueThisMonth) - Number(debt.computedMonthlyPayment)) > 0.009;
  const showMonthlyPayment = !derived.isCardDebt && Number.isFinite(monthlyPaymentNum) && monthlyPaymentNum > 0;
  const projectionMonthlyPayment = debt.computedMonthlyPayment != null
    ? debt.computedMonthlyPayment
    : (derived.isCardDebt ? (derived.monthlyMinNum ?? 0) : monthlyPaymentNum);
  const payoffSummary = (() => {
    const monthlyRate = derived.interestRateNum ? derived.interestRateNum / 100 / 12 : 0;
    const points = buildProjection(derived.currentBalNum, projectionMonthlyPayment, monthlyRate);
    return derivePayoffSummary({
      points,
      monthlyPayment: projectionMonthlyPayment,
      monthsLeftOverride: debt.computedMonthsLeft,
      paidOffByOverride: debt.computedPaidOffBy,
    });
  })();
  const progressText = derived.progressLabel ?? `${derived.progressPct.toFixed(1)}% paid off`;
  const logoUri = resolveLogoUri(debt.logoUrl);

  const detailsContent = (
    <>
      <View style={s.projectionSection}>
        <View style={s.projectionTopRow}>
          <View style={s.projectionHeader}>
            <Text style={s.projectionBalanceLabel}>Current balance</Text>
            <Text style={[s.projectionBalanceValue, derived.isPaid && { color: T.green }]}>
              {derived.isPaid ? "Paid off" : fmt(derived.currentBalNum, currency)}
            </Text>
            <Text
              style={[
                s.projectionBalanceSub,
                derived.progressPct > 0
                  ? s.projectionBalanceSubPositive
                  : derived.progressPct < 0
                    ? s.projectionBalanceSubNegative
                    : s.projectionBalanceSubNeutral,
              ]}
            >
              {progressText}
            </Text>
          </View>

          <View style={s.projectionLogoCircle}>
            {logoUri ? (
              <Image
                source={{ uri: logoUri }}
                style={s.projectionLogoImage}
                resizeMode="contain"
              />
            ) : (
              <Text style={s.projectionLogoFallback}>{(debt.name?.trim()?.[0] ?? "?").toUpperCase()}</Text>
            )}
          </View>
        </View>

        {!derived.isPaid ? (
          <PayoffChart
            balance={derived.currentBalNum}
            monthlyPayment={projectionMonthlyPayment}
            monthsLeftOverride={debt.computedMonthsLeft}
            paidOffByOverride={debt.computedPaidOffBy}
            cannotPayoffOverride={debt.computedCannotPayoff}
            payoffLabelOverride={debt.computedPayoffLabel}
            horizonLabelOverride={debt.computedHorizonLabel}
            interestRate={derived.interestRateNum}
            currency={currency}
          />
        ) : null}

        {!derived.isPaid ? (
          <View style={s.projectionMetaRow}>
            <View style={s.projectionMetaItem}>
              <Text style={s.projectionMetaLabel}>Months left</Text>
              <Text style={[s.projectionMetaValue, payoffSummary.cannotPayoff && s.projectionMetaValueWarning]}>
                {payoffSummary.cannotPayoff ? "—" : String(payoffSummary.totalMonths)}
              </Text>
            </View>
            <View style={s.projectionMetaDivider} />
            <View style={s.projectionMetaItem}>
              <Text style={s.projectionMetaLabel}>Paid off by</Text>
              <Text
                style={[
                  s.projectionMetaValue,
                  !payoffSummary.cannotPayoff && (derived.isPaid || payoffSummary.payoffLabel) ? s.projectionMetaValuePositive : null,
                  payoffSummary.cannotPayoff ? s.projectionMetaValueWarning : null,
                ]}
              >
                {derived.isPaid ? "Paid" : (payoffSummary.payoffLabel ?? "—")}
              </Text>
            </View>
          </View>
        ) : null}
      </View>

      <DebtStatsGrid
        isCardDebt={derived.isCardDebt && (derived.creditLimitNum ?? 0) > 0}
        creditLimit={fmt(derived.creditLimitNum ?? 0, currency)}
        original={fmt(derived.originalBalNum, currency)}
        paidSoFarLabel={derived.isOverLimit ? "Over limit" : undefined}
        paidSoFar={derived.isOverLimit ? `-${fmt(Math.abs(derived.paidMetricAmount), currency)}` : fmt(derived.paidMetricAmount, currency)}
        paidSoFarTone={derived.isOverLimit ? "red" : "green"}
        dueCoveredThisCycle={derived.dueCoveredThisCycle}
        dueDateLabel={derived.dueDateLabel}
        dueStatusSub={
          !derived.dueCoveredThisCycle && derived.dueDateLabel !== "Not set"
            ? (derived.isOverdue ? "Overdue (+5 day grace passed)" : "On schedule")
            : undefined
        }
        dueTone={derived.dueCoveredThisCycle ? "green" : derived.isOverdue ? "red" : "normal"}
        monthlyOrInterestLabel={
          derived.isCardDebt
            ? (derived.dueTarget > 0 ? (hasCurrentPeriodPaymentOverride ? "This period payment" : "Monthly payment") : (derived.interestRateNum != null && derived.interestRateNum > 0 ? "Interest Rate" : "Monthly min"))
            : (showMonthlyPayment ? (hasCurrentPeriodPaymentOverride ? "This period payment" : "Monthly payment") : "Interest Rate")
        }
        monthlyOrInterestValue={
          derived.isCardDebt
            ? (derived.dueTarget > 0
                ? fmt(derived.dueTarget, currency)
                : (derived.interestRateNum != null && derived.interestRateNum > 0 ? `${derived.interestRateNum}%` : "—"))
            : (showMonthlyPayment
                ? fmt(monthlyPaymentNum, currency)
                : (derived.interestRateNum != null && derived.interestRateNum > 0 ? `${derived.interestRateNum}%` : "—"))
        }
        monthlyOrInterestSub={
          hasCurrentPeriodPaymentOverride && debt.computedMonthlyPayment != null
            ? `Recurring ${fmt(debt.computedMonthlyPayment, currency)}`
            : (derived.isCardDebt && derived.monthlyMinNum != null && derived.monthlyMinNum > 0 && derived.dueTarget > derived.monthlyMinNum
                ? `Min ${fmt(derived.monthlyMinNum, currency)}`
                : undefined)
        }
      />
    </>
  );

  return (
    <SafeAreaView style={s.safe} edges={["bottom"]}>
      <DebtDetailHeader
        title={debt.name}
        editing={state.editing}
        hideActions
        onBack={() => navigation.goBack()}
        onToggleEdit={() => state.setEditing((prev) => !prev)}
        onDelete={() => state.setDeleteConfirmOpen(true)}
      />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          style={{ backgroundColor: T.bg }}
          contentContainerStyle={[s.scroll, { paddingTop: insets.top + 88, paddingBottom: 120 + insets.bottom + 12 }]}
          refreshControl={<RefreshControl refreshing={state.refreshing} onRefresh={() => { state.setRefreshing(true); state.load(); }} tintColor={T.accent} />}
        >
          <View style={s.detailModeSwitch}>
            <Pressable
              onPress={() => setActiveTab("details")}
              style={[s.detailModeOption, activeTab === "details" && s.detailModeOptionActive]}
            >
              <Text style={[s.detailModeText, activeTab === "details" && s.detailModeTextActive]}>Details</Text>
            </Pressable>
            <Pressable
              onPress={() => setActiveTab("payments")}
              style={[s.detailModeOption, activeTab === "payments" && s.detailModeOptionActive]}
            >
              <Text style={[s.detailModeText, activeTab === "payments" && s.detailModeTextActive]}>Payments</Text>
            </Pressable>
          </View>

          {activeTab === "details" ? detailsContent : <PaymentHistorySection payments={state.payments} currency={currency} />}
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={[s.bottomActionsWrap, { paddingBottom: insets.bottom + 10 }]}> 
        <View style={s.bottomActionsRow}>
          {!derived.isPaid ? (
            <Pressable
              style={[s.bottomActionBtn, s.bottomPrimaryActionBtn]}
              onPress={() => state.setPaySheetOpen(true)}
            >
              <BlurView intensity={34} tint="dark" style={[s.bottomActionGlass, s.bottomActionGlassPayment]}>
                <View style={[s.bottomActionTint, s.bottomActionTintPayment]} pointerEvents="none" />
                <View style={[s.bottomActionGlow, s.bottomActionGlowPayment]} pointerEvents="none" />
                <View style={[s.bottomActionInnerBorder, s.bottomActionInnerBorderPayment]} pointerEvents="none" />
                <View style={s.bottomActionContent}>
                  <Ionicons name="wallet-outline" size={18} color={T.text} />
                  <Text style={[s.bottomActionTxt, s.bottomActionTxtPrimary]}>Record payment</Text>
                </View>
              </BlurView>
            </Pressable>
          ) : null}

          <Pressable
            style={[s.bottomActionBtn, s.bottomIconActionBtn]}
            onPress={() => state.setEditing((prev) => !prev)}
          >
            <BlurView intensity={34} tint="light" style={s.bottomActionGlass}>
              <View style={[s.bottomActionTint, s.bottomActionTintEdit]} pointerEvents="none" />
              <View style={[s.bottomActionGlow, s.bottomActionGlowEdit]} pointerEvents="none" />
              <View style={s.bottomActionInnerBorder} pointerEvents="none" />
              <Ionicons name={state.editing ? "close-outline" : "create-outline"} size={20} color="#162033" />
            </BlurView>
          </Pressable>
          <Pressable
            style={[s.bottomActionBtn, s.bottomIconActionBtn]}
            onPress={() => state.setDeleteConfirmOpen(true)}
          >
            <BlurView intensity={34} tint="light" style={s.bottomActionGlass}>
              <View style={[s.bottomActionTint, s.bottomActionTintDelete]} pointerEvents="none" />
              <View style={[s.bottomActionGlow, s.bottomActionGlowDelete]} pointerEvents="none" />
              <View style={s.bottomActionInnerBorder} pointerEvents="none" />
              <Ionicons name="trash-outline" size={20} color="#162033" />
            </BlurView>
          </Pressable>
        </View>
      </View>

      <PaymentSheet
        visible={state.paySheetOpen}
        currency={currency}
        payAmount={state.payAmount}
        paying={state.paying}
        onChangeAmount={state.setPayAmount}
        onClose={() => state.setPaySheetOpen(false)}
        onSave={state.handlePay}
        onMarkPaid={state.handleMarkPaid}
        showMarkPaid={!derived.isPaid && derived.dueRemainingThisCycle > 0.005}
        markPaidLabel={`Mark due as paid (${fmt(derived.dueRemainingThisCycle, currency)})`}
      />

      <EditDebtSheet
        visible={state.editing}
        saving={state.editSaving}
        currency={state.settings?.currency}
        name={state.editName}
        currentBalance={state.editCurrentBalance}
        interestRate={state.editRate}
        monthlyPayment={state.editMonthlyPayment}
        plannedPaymentOverride={state.editPlannedPaymentOverride}
        plannedPaymentOverridePeriodKey={state.editPlannedPaymentOverridePeriodKey}
        plannedPaymentOverrideOptions={state.plannedPaymentOverrideOptions}
        monthlyMinimum={state.editMin}
        dueDate={state.editDueDate}
        installment={state.editInstallment}
        paymentSource={state.editPaymentSource}
        paymentCardDebtId={state.editPaymentCardDebtId}
        paymentCards={state.availablePaymentCards}
        showDatePicker={state.showDatePicker}
        onClose={() => state.setEditing(false)}
        onSave={state.handleEdit}
        onChangeName={state.setEditName}
        onChangeCurrentBalance={state.handleEditCurrentBalanceChange}
        onChangeRate={state.setEditRate}
        onChangeMonthlyPayment={state.handleEditMonthlyPaymentChange}
        onChangePlannedPaymentOverride={state.setEditPlannedPaymentOverride}
        onChangePlannedPaymentOverrideTarget={state.setEditPlannedPaymentOverridePeriodKey}
        onChangeMin={state.handleEditMinChange}
        onPickDate={() => state.setShowDatePicker(true)}
        onDateChange={state.setEditDueDate}
        onChangePaymentSource={state.setEditPaymentSource}
        onChangePaymentCardDebtId={state.setEditPaymentCardDebtId}
        onChangeInstallment={state.handleEditInstallmentChange}
        onSetShowDatePicker={state.setShowDatePicker}
      />

      <DeleteConfirmSheet
        visible={state.deleteConfirmOpen}
        title="Delete Debt"
        description={`Are you sure you want to delete "${debt.name}"? This cannot be undone.`}
        isBusy={state.deletingDebt}
        onClose={() => {
          if (state.deletingDebt) return;
          state.setDeleteConfirmOpen(false);
        }}
        onConfirm={state.confirmDeleteDebt}
      />
    </SafeAreaView>
  );
}

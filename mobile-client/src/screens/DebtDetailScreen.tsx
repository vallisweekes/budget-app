import React from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, RefreshControl, SafeAreaView, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";

import type { DebtStackParamList } from "@/navigation/types";
import { T } from "@/lib/theme";
import { fmt } from "@/lib/formatting";
import { cardBase } from "@/lib/ui";
import DeleteConfirmSheet from "@/components/Shared/DeleteConfirmSheet";
import DebtDetailHeader from "@/components/Debts/Detail/DebtDetailHeader";
import DebtHero from "@/components/Debts/Detail/DebtHero";
import DebtStatsGrid from "@/components/Debts/Detail/DebtStatsGrid";
import PayoffChart from "@/components/Debts/Detail/PayoffChart";
import PaymentSheet from "@/components/Debts/Detail/PaymentSheet";
import EditDebtSheet from "@/components/Debts/Detail/EditDebtSheet";
import PaymentHistorySection from "@/components/Debts/Detail/PaymentHistorySection";
import { useDebtDetailController } from "@/screens/debt-detail/useDebtDetailController";

type Route = RouteProp<DebtStackParamList, "DebtDetail">;

export default function DebtDetailScreen() {
  const navigation = useNavigation();
  const { params } = useRoute<Route>();
  const { debtId, debtName } = params;
  const { height } = useWindowDimensions();

  const state = useDebtDetailController({ debtId, debtName, onDeleted: () => navigation.goBack() });
  const { debt, loading, error, currency, derived } = state;

  if (loading) {
    return (
      <SafeAreaView style={s.safe}>
        <DebtDetailHeader title={debtName} editing={false} onBack={() => navigation.goBack()} onToggleEdit={() => {}} onDelete={() => {}} />
        <View style={s.center}><ActivityIndicator size="large" color={T.accent} /></View>
      </SafeAreaView>
    );
  }

  if (error || !debt) {
    return (
      <SafeAreaView style={s.safe}>
        <DebtDetailHeader title={debtName} editing={false} onBack={() => navigation.goBack()} onToggleEdit={() => {}} onDelete={() => {}} />
        <View style={s.center}>
          <Ionicons name="cloud-offline-outline" size={48} color={T.textDim} />
          <Text style={s.errorText}>{error ?? "Debt not found"}</Text>
          <Pressable onPress={state.load} style={s.retryBtn}><Text style={s.retryTxt}>Retry</Text></Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe}>
      <DebtDetailHeader
        title={debt.name}
        editing={state.editing}
        onBack={() => navigation.goBack()}
        onToggleEdit={() => state.setEditing((prev) => !prev)}
        onDelete={() => state.setDeleteConfirmOpen(true)}
      />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          style={{ backgroundColor: T.bg }}
          contentContainerStyle={s.scroll}
          refreshControl={<RefreshControl refreshing={state.refreshing} onRefresh={() => { state.setRefreshing(true); state.load(); }} tintColor={T.accent} />}
        >
          <DebtHero
            currentBalanceLabel="Current balance"
            currentBalanceValue={derived.isPaid ? "Paid off" : fmt(derived.currentBalNum, currency)}
            isPaid={derived.isPaid}
            progressPct={derived.progressPct}
            isVerySmallScreen={height <= 740}
            onRecordPayment={() => state.setPaySheetOpen(true)}
          />

          <DebtStatsGrid
            isCardDebt={derived.isCardDebt && (derived.creditLimitNum ?? 0) > 0}
            creditLimit={fmt(derived.creditLimitNum ?? 0, currency)}
            original={fmt(derived.originalBalNum, currency)}
            paidSoFar={fmt(derived.paidSoFarNum, currency)}
            dueCoveredThisCycle={derived.dueCoveredThisCycle}
            dueDateLabel={derived.dueDateLabel}
            dueStatusSub={!derived.dueCoveredThisCycle && derived.dueDateLabel !== "Not set" ? (derived.isMissed ? "Missed (+5 day grace passed)" : derived.isOverdue ? "Overdue" : "On schedule") : undefined}
            dueTone={derived.dueCoveredThisCycle ? "green" : derived.isMissed ? "red" : derived.isOverdue ? "orange" : "normal"}
            monthlyOrInterestLabel={derived.monthlyMinNum != null && derived.monthlyMinNum > 0 ? "Monthly min" : "Interest Rate"}
            monthlyOrInterestValue={derived.monthlyMinNum != null && derived.monthlyMinNum > 0 ? fmt(derived.monthlyMinNum, currency) : (derived.interestRateNum != null && derived.interestRateNum > 0 ? `${derived.interestRateNum}%` : "—")}
          />

          {!derived.isPaid ? (
            <View style={s.sectionCard}>
              <Text style={s.sectionTitle}>Payoff Projection</Text>
              <PayoffChart
                balance={derived.currentBalNum}
                monthlyPayment={derived.monthlyMinNum ?? 0}
                interestRate={derived.interestRateNum}
                currency={currency}
              />
            </View>
          ) : null}

          <PaymentHistorySection
            payments={state.payments}
            currency={currency}
            open={state.paymentHistoryOpen}
            onToggle={() => state.setPaymentHistoryOpen((value) => !value)}
          />
        </ScrollView>
      </KeyboardAvoidingView>

      <PaymentSheet
        visible={state.paySheetOpen}
        currency={currency}
        payAmount={state.payAmount}
        paying={state.paying}
        onChangeAmount={state.setPayAmount}
        onClose={() => state.setPaySheetOpen(false)}
        onSave={state.handlePay}
        onMarkPaid={state.handleMarkPaid}
      />

      <EditDebtSheet
        visible={state.editing}
        saving={state.editSaving}
        name={state.editName}
        interestRate={state.editRate}
        monthlyMinimum={state.editMin}
        dueDay={state.editDue}
        dueDate={state.editDueDate}
        installment={state.editInstallment}
        autoPay={state.editAutoPay}
        showDatePicker={state.showDatePicker}
        onClose={() => state.setEditing(false)}
        onSave={state.handleEdit}
        onChangeName={state.setEditName}
        onChangeRate={state.setEditRate}
        onChangeMin={state.setEditMin}
        onChangeDueDay={state.setEditDue}
        onPickDate={() => state.setShowDatePicker(true)}
        onDateChange={state.setEditDueDate}
        onToggleAutoPay={state.setEditAutoPay}
        onChangeInstallment={state.setEditInstallment}
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

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.bg },
  center: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12 },
  scroll: { padding: 14, gap: 14, paddingBottom: 40 },
  sectionCard: {
    ...cardBase,
    borderRadius: 14,
    padding: 14,
    gap: 12,
    borderWidth: 2,
    borderColor: T.accentBorder,
  },
  sectionTitle: { color: T.text, fontSize: 14, fontWeight: "900" },
  errorText: { color: T.red, fontSize: 14, textAlign: "center", paddingHorizontal: 32 },
  retryBtn: { backgroundColor: T.accent, borderRadius: 8, paddingHorizontal: 24, paddingVertical: 10 },
  retryTxt: { color: T.onAccent, fontWeight: "700" },
});

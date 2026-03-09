import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import type { DashboardScreenProps } from "@/types";
import BudgetDonutCard from "@/components/Dashboard/BudgetDonutCard";
import CategorySwipeCards from "@/components/Dashboard/CategorySwipeCards";
import QuickPaymentActionSheet from "@/components/Dashboard/QuickPaymentActionSheet";
import { fmt } from "@/lib/formatting";
import { useDashboardScreenController } from "@/lib/hooks/useDashboardScreenController";
import { T } from "@/lib/theme";
import DashboardAiTipsCard from "@/components/DashboardScreen/DashboardAiTipsCard";
import DashboardCategorySheet from "@/components/DashboardScreen/DashboardCategorySheet";
import DashboardGoalsSection from "@/components/DashboardScreen/DashboardGoalsSection";
import DashboardRecapSection from "@/components/DashboardScreen/DashboardRecapSection";
import DashboardUpcomingDebtsSection from "@/components/DashboardScreen/DashboardUpcomingDebtsSection";
import DashboardUpcomingExpensesSection from "@/components/DashboardScreen/DashboardUpcomingExpensesSection";
import { styles } from "@/components/DashboardScreen/style";

export default function DashboardScreen(props: DashboardScreenProps) {
  const controller = useDashboardScreenController(props);

  if (controller.loading) {
    return (
      <SafeAreaView style={[styles.safe, { paddingTop: controller.topHeaderOffset }]} edges={[]}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={T.accent} />
          <Text style={styles.loadingText}>Loading dashboard...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (controller.error) {
    if (controller.isRedirectingForSetup) {
      return (
        <SafeAreaView style={[styles.safe, { paddingTop: controller.topHeaderOffset }]} edges={[]}>
          <View style={styles.center}>
            <ActivityIndicator size="large" color={T.accent} />
          </View>
        </SafeAreaView>
      );
    }

    return (
      <SafeAreaView style={[styles.safe, { paddingTop: controller.topHeaderOffset }]} edges={[]}>
        <View style={styles.center}>
          <Ionicons name="cloud-offline-outline" size={48} color={T.iconMuted} />
          <Text style={styles.errorText}>{controller.error.message}</Text>
          <Pressable onPress={() => void controller.load({ force: true })} style={styles.retryBtn}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={[]}>
      <QuickPaymentActionSheet
        visible={Boolean(controller.quickPayItem)}
        item={controller.quickPayItem}
        currency={controller.currency}
        insetsBottom={controller.insetsBottom}
        onClose={controller.closeQuickPay}
        onUpdated={controller.handleQuickPayUpdated}
      />

      <DashboardCategorySheet
        visible={Boolean(controller.categorySheet)}
        categoryName={controller.categorySheet?.name ?? "Category"}
        expenses={controller.selectedExpenses}
        currency={controller.currency}
        dragY={controller.categorySheetDragY}
        panHandlers={controller.categorySheetPanHandlers}
        onClose={controller.closeCategorySheet}
      />

      <ScrollView
        ref={controller.scrollRef}
        refreshControl={<RefreshControl refreshing={controller.refreshing} onRefresh={controller.onRefresh} tintColor={T.accent} />}
        contentContainerStyle={[styles.scroll, { paddingTop: controller.topHeaderOffset + 8 }]}
        showsVerticalScrollIndicator={false}
      >
        {controller.hasPayDateConfigured ? (
          <View style={styles.currentPeriodBadge}>
            <Text style={styles.currentPeriodBadgeText}>{controller.payPeriodLabel}</Text>
          </View>
        ) : null}

        <BudgetDonutCard
          totalBudget={controller.totalBudget}
          totalExpenses={controller.totalExpenses}
          paidTotal={controller.paidTotal}
          currency={controller.currency}
          fmt={fmt}
        />

        {(controller.isOverBudgetBySpending || controller.hasOverLimitDebt) ? (
          <View style={styles.alertCard}>
            <Text style={styles.alertTitle}>{controller.isOverBudgetBySpending ? "Over budget" : "Credit limit exceeded"}</Text>
            {controller.isOverBudgetBySpending ? (
              <Text style={styles.alertText}>
                Spending is {fmt(Math.abs(controller.amountAfterExpenses), controller.currency)} over your monthly plan.
              </Text>
            ) : (
              <Text style={styles.alertText}>
                {controller.overLimitDebtCount} card{controller.overLimitDebtCount === 1 ? "" : "s"} over credit limit.
              </Text>
            )}
          </View>
        ) : null}

        {controller.needsSetup ? (
          <View style={styles.setupCard}>
            <Text style={styles.setupTitle}>Get your plan ready</Text>
            <Text style={styles.setupText}>Add or update your income and expenses so your dashboard can calculate real totals.</Text>
            <View style={styles.setupActions}>
              <Pressable onPress={controller.goToIncome} style={styles.setupBtn}>
                <Text style={styles.setupBtnText}>Go to Income</Text>
              </Pressable>
              <Pressable onPress={controller.goToExpenses} style={styles.setupBtn}>
                <Text style={styles.setupBtnText}>Go to Expenses</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {!controller.hasPayDateConfigured ? (
          <View style={styles.setupCard}>
            <Text style={styles.setupTitle}>Set your pay date</Text>
            <Text style={styles.setupText}>Upcoming expenses and debts use your pay period. Add your pay date so this view matches your real cycle.</Text>
            <View style={styles.setupActions}>
              <Pressable onPress={controller.goToSettings} style={styles.setupBtn}>
                <Text style={styles.setupBtnText}>Set pay date</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        <CategorySwipeCards
          categories={controller.categories}
          totalIncome={controller.totalIncome}
          currency={controller.currency}
          fmt={fmt}
          onPressCategory={controller.openCategorySheet}
        />

        <DashboardUpcomingExpensesSection
          items={controller.upcoming}
          currency={controller.currency}
          formatShortDate={controller.formatShortDate}
          isLogoFailed={controller.isLogoFailed}
          onLogoError={controller.markLogoFailed}
          onOpenQuickPay={controller.openExpenseQuickPay}
          onSeeAll={controller.goToExpenses}
        />

        <DashboardAiTipsCard tips={controller.dashboardTips} />

        <DashboardUpcomingDebtsSection
          items={controller.upcomingDebts}
          currency={controller.currency}
          isLogoFailed={controller.isLogoFailed}
          onLogoError={controller.markLogoFailed}
          onOpenQuickPay={controller.openDebtQuickPay}
          onSeeAll={controller.goToDebts}
        />

        <DashboardRecapSection
          recap={controller.recap}
          hasRecapData={controller.hasRecapData}
          recapTitle={controller.recapTitle}
          currency={controller.currency}
        />

        <DashboardGoalsSection
          items={controller.goalCardsData}
          settings={controller.settings}
          currency={controller.currency}
          activeGoalCard={controller.activeGoalCard}
          onMomentumEnd={controller.handleGoalMomentumEnd}
          onPressGoals={controller.goToGoals}
          onPressProjection={controller.goToGoalsProjection}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
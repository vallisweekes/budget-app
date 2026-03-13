import React from "react";
import { View, Text, FlatList, Pressable, ActivityIndicator, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import type { Expense } from "@/lib/apiTypes";
import AddExpenseSheet from "@/components/Expenses/AddExpenseSheet";
import CategoryExpenseCard from "@/components/Expenses/CategoryExpenseCard";
import CategoryExpensesHero from "@/components/Expenses/CategoryExpensesHero";
import CategoryExpensesMonthPicker from "@/components/Expenses/CategoryExpensesMonthPicker";
import { useCategoryExpensesScreenController } from "@/hooks";
import { T } from "@/lib/theme";
import { categoryExpensesStyles as styles } from "@/components/CategoryExpensesScreen/style";
import { styles as rowStyles } from "@/components/Expenses/CategoryExpenseCard/styles";
import type { CategoryExpensesScreenProps } from "@/types";

export default function CategoryExpensesScreen({ route, navigation }: CategoryExpensesScreenProps) {
  const controller = useCategoryExpensesScreenController({ navigation, route });

  return (
    <SafeAreaView style={styles.safe} edges={[]}>
      <FlatList<Expense>
        data={controller.expenses}
        keyExtractor={(e) => e.id}
        renderItem={({ item }) => (
          <CategoryExpenseCard
            categoryColor={controller.categoryColor}
            currency={controller.currency}
            expense={item}
            logoFailed={Boolean(controller.logoFailed[item.id])}
            onLogoError={(expenseId) => controller.setLogoFailed((prev) => ({ ...prev, [expenseId]: true }))}
            onPress={controller.onPressExpense}
          />
        )}
        contentContainerStyle={rowStyles.list}
        refreshControl={
          <RefreshControl refreshing={controller.refreshing} onRefresh={controller.onRefresh} tintColor={T.textDim} />
        }
        ListHeaderComponent={
          <CategoryExpensesHero
            currency={controller.currency}
            heroPeriodLabel={controller.heroPeriodLabel}
            onPressAdd={controller.openAddSheet}
            onPressMonth={controller.openMonthPicker}
            paidPct={controller.paidPct}
            paidTotal={controller.paidTotal}
            plannedTotal={controller.plannedTotal}
            remainingPct={controller.remainingPct}
            remainingTotal={controller.remainingTotal}
            topHeaderOffset={controller.topHeaderOffset}
            updatedLabel={controller.updatedLabel}
          />
        }
        ListEmptyComponent={
          controller.loading ? (
            <View style={[styles.center, { paddingTop: 20 }]}>
              <ActivityIndicator color={T.accent} />
              <Text style={styles.emptyTxt}>Loading…</Text>
            </View>
          ) : controller.error ? (
            <View style={[styles.center, { paddingTop: 20 }]}>
              <Text style={styles.errTxt}>{controller.error}</Text>
              <Pressable style={styles.retryBtn} onPress={controller.retry}>
                <Text style={styles.retryTxt}>Retry</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.center}>
              <Text style={styles.emptyTxt}>No expenses yet.</Text>
            </View>
          )
        }
      />

      <CategoryExpensesMonthPicker
        month={controller.month}
        onClose={() => controller.setMonthPickerOpen(false)}
        onSelectMonth={controller.onChangeMonth}
        pickerYear={controller.pickerYear}
        setPickerYear={controller.setPickerYear}
        getPeriodOptionLabel={controller.getPeriodOptionLabel}
        visible={controller.monthPickerOpen}
        year={controller.year}
      />

      <AddExpenseSheet
        visible={controller.addSheetOpen}
        month={controller.month}
        year={controller.year}
        budgetPlanId={controller.budgetPlanId}
        initialCategoryId={controller.categoryId}
        headerTitle={controller.categoryName}
        currency={controller.currency}
        categories={controller.categoriesForAddSheet}
        onAdded={controller.onAddComplete}
        onClose={() => controller.setAddSheetOpen(false)}
      />
    </SafeAreaView>
  );
}

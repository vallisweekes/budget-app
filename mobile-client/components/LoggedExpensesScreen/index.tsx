import React from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";

import type { Expense } from "@/lib/apiTypes";
import LoggedExpenseCard from "@/components/Expenses/LoggedExpenseCard";
import LoggedExpensesHero from "@/components/Expenses/LoggedExpensesHero";
import { useLoggedExpensesScreenController } from "@/hooks";
import { T } from "@/lib/theme";
import { loggedExpensesStyles as styles } from "@/components/LoggedExpensesScreen/style";
import type { LoggedExpensesScreenProps } from "@/types";

export default function LoggedExpensesScreen({ route, navigation }: LoggedExpensesScreenProps) {
  const controller = useLoggedExpensesScreenController({ route, navigation });

  return (
    <SafeAreaView style={styles.safe} edges={[]}>
      <FlatList<Expense>
        data={controller.items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={controller.refreshing} onRefresh={controller.onRefresh} tintColor={T.textDim} />
        }
        ListHeaderComponent={
          <LoggedExpensesHero
            currency={controller.currency}
            itemCount={controller.items.length}
            periodLabel={controller.periodLabel}
            screenKicker={controller.screenKicker}
            topHeaderOffset={controller.topHeaderOffset}
            total={controller.total}
          />
        }
        renderItem={({ item }) => (
          <LoggedExpenseCard
            categoryColor={controller.categoryColor}
            categoryName={controller.categoryName}
            currency={controller.currency}
            deleting={controller.deletingExpenseId === item.id}
            item={item}
            onDelete={controller.onDeleteItem}
            onPress={controller.onPressItem}
          />
        )}
        ListEmptyComponent={
          controller.loading ? (
            <View style={styles.center}>
              <ActivityIndicator color={T.accent} />
              <Text style={styles.empty}>Loading…</Text>
            </View>
          ) : controller.error ? (
            <View style={styles.center}>
              <Text style={styles.error}>{controller.error}</Text>
              <Pressable style={styles.retryBtn} onPress={controller.retry}>
                <Text style={styles.retryText}>Retry</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.center}>
              <Text style={styles.empty}>No logged expenses in this period.</Text>
            </View>
          )
        }
      />

      <View pointerEvents="box-none" style={styles.footerOverlay}>
        <BlurView intensity={20} tint="dark" style={styles.footerBackdrop} pointerEvents="none" />
        <View style={styles.footerBackdropTint} pointerEvents="none" />
        <View style={styles.footerInner}>
          <Pressable
            style={({ pressed }) => [styles.quickLogBtn, pressed && styles.quickLogBtnPressed]}
            onPress={() => navigation.navigate("UnplannedExpense", {
              month: controller.month,
              year: controller.year,
              sourceContext: "logged_expenses",
            })}
            accessibilityRole="button"
            accessibilityLabel="Log expense"
          >
            <Ionicons name="add" size={24} color={T.text} />
          </Pressable>

          <View style={styles.searchWrap}>
            <BlurView intensity={24} tint="dark" style={styles.footerBackdrop} pointerEvents="none" />
            <View style={styles.searchInner}>
              <Ionicons name="search" size={18} color={T.textDim} />
              <TextInput
                value={controller.searchQuery}
                onChangeText={controller.onSearchQueryChange}
                placeholder="Search logged expenses"
                placeholderTextColor={T.textMuted}
                style={styles.searchInput}
                autoCorrect={false}
                spellCheck={false}
                autoCapitalize="none"
                returnKeyType="search"
              />
            </View>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

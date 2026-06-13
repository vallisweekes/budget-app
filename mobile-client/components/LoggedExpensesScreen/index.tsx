import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import type { Expense } from "@/lib/apiTypes";
import LoggedExpenseCard from "@/components/Expenses/LoggedExpenseCard";
import LoggedExpensesHero from "@/components/Expenses/LoggedExpensesHero";
import LoggedExpenseAddSheet from "@/components/LoggedExpenseAddSheet";
import { useLoggedExpensesScreenController } from "@/hooks";
import { subscribeLoggedExpenseAddTrigger } from "@/lib/events/loggedExpenseAddTrigger";
import { setLoggedExpensesFooterSearchQuery, useLoggedExpensesFooterSearchQuery } from "@/lib/events/loggedExpensesFooterSearch";
import { T } from "@/lib/theme";
import { loggedExpensesStyles as styles } from "@/components/LoggedExpensesScreen/style";
import type { LoggedExpensesScreenProps } from "@/types";

type LoggedExpensesScreenWithSearchProps = LoggedExpensesScreenProps & {
  searchQueryOverride?: string;
};

export default function LoggedExpensesScreen({ route, navigation, searchQueryOverride }: LoggedExpensesScreenWithSearchProps) {
  const controller = useLoggedExpensesScreenController({ route, navigation }, { searchQueryOverride });
  const searchInputRef = useRef<TextInput>(null);
  const searchQuery = useLoggedExpensesFooterSearchQuery();
  const [addSheetOpen, setAddSheetOpen] = useState(false);

  useEffect(() => {
    return subscribeLoggedExpenseAddTrigger(() => {
      setAddSheetOpen(true);
    });
  }, []);

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
          <>
            <LoggedExpensesHero
              currency={controller.currency}
              itemCount={controller.items.length}
              periodLabel={controller.periodLabel}
              screenKicker={controller.screenKicker}
              topHeaderOffset={controller.topHeaderOffset}
              total={controller.total}
            />
            <View style={styles.searchWrap}>
              <View style={styles.searchPill}>
                <Pressable hitSlop={8} onPress={() => searchInputRef.current?.focus()}>
                  <Ionicons name="search" size={18} color={T.textDim} />
                </Pressable>
                <TextInput
                  ref={searchInputRef}
                  value={searchQuery}
                  onChangeText={setLoggedExpensesFooterSearchQuery}
                  placeholder="Search logged expenses"
                  placeholderTextColor={T.textDim}
                  returnKeyType="search"
                  selectionColor={T.accent}
                  style={styles.searchInput}
                />
                {searchQuery.trim() ? (
                  <Pressable hitSlop={8} onPress={() => setLoggedExpensesFooterSearchQuery("")}>
                    <Ionicons name="close-circle" size={17} color={T.textDim} />
                  </Pressable>
                ) : null}
              </View>
            </View>
          </>
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
      <LoggedExpenseAddSheet
        visible={addSheetOpen}
        onClose={() => setAddSheetOpen(false)}
        month={controller.month}
        year={controller.year}
      />
    </SafeAreaView>
  );
}

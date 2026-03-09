import React from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

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
            item={item}
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
    </SafeAreaView>
  );
}

import { FlatList, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import type { DashboardGoalsSectionProps } from "@/types";
import { fmt } from "@/lib/formatting";
import { resolveGoalCurrentAmount } from "@/lib/helpers/settings";
import { T } from "@/lib/theme";
import { GOAL_GAP, GOAL_SIDE, styles } from "@/components/DashboardScreen/style";
import { getGoalIconName } from "@/components/DashboardScreen/utils";

export default function DashboardGoalsSection({
  items,
  settings,
  currency,
  activeGoalCard,
  onMomentumEnd,
  onPressGoals,
  onPressProjection,
}: DashboardGoalsSectionProps) {
  if (items.length === 0) return null;

  return (
    <View style={styles.goalsWrap}>
      <View style={styles.goalsHeaderRow}>
        <Pressable onPress={onPressGoals} hitSlop={8}>
          <Text style={styles.seeAllGoalsText}>See all goals</Text>
        </Pressable>
        <Pressable onPress={onPressProjection} hitSlop={8}>
          <Text style={styles.goalsProjectionTitle}>Goals projection</Text>
        </Pressable>
      </View>

      <FlatList
        horizontal
        data={items}
        keyExtractor={(item) => item.goal.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: GOAL_SIDE }}
        bounces
        onMomentumScrollEnd={(event) => onMomentumEnd(event.nativeEvent.contentOffset.x)}
        renderItem={({ item }) => {
          const goal = item.goal;
          const hasTarget = typeof goal.targetAmount === "number" && Number.isFinite(goal.targetAmount);
          const category = String(goal.category ?? "").trim().toLowerCase();
          const currentAmount = resolveGoalCurrentAmount(category, goal.currentAmount, settings);
          const targetAmount = hasTarget ? Number(goal.targetAmount) : null;
          const percent = targetAmount && targetAmount > 0 ? Math.min(100, Math.max(0, (currentAmount / targetAmount) * 100)) : 0;
          const primaryAmount = fmt(currentAmount, currency);
          const amountLine = targetAmount ? `Target ${fmt(targetAmount, currency)}` : String(goal.type ?? "");

          return (
            <View style={styles.goalCard}>
              <View style={styles.goalHeaderRow}>
                <View style={styles.goalHeaderLeft}>
                  <View style={styles.goalChip}>
                    <Ionicons name={getGoalIconName(goal.title)} size={16} color={T.accent} />
                  </View>
                  <Text style={styles.goalTitle} numberOfLines={2}>
                    {goal.title}
                  </Text>
                </View>
              </View>

              <View style={styles.goalMainBlock}>
                <Text style={styles.goalPrimaryAmt} numberOfLines={1}>
                  {primaryAmount}
                </Text>
                <Text style={styles.goalAmountLine} numberOfLines={1}>
                  {amountLine}
                </Text>
                {targetAmount ? (
                  <View style={styles.goalPctRow}>
                    <View style={styles.goalPctPill}>
                      <Ionicons name="arrow-up" size={12} color={T.accent} />
                      <Text style={styles.goalPctText}>{`${percent.toFixed(0)}%`}</Text>
                    </View>
                  </View>
                ) : null}
              </View>

              {targetAmount ? (
                <View style={styles.goalBarBg}>
                  <View style={[styles.goalBarFill, { width: `${percent}%` as `${number}%` }]} />
                </View>
              ) : (
                <View style={{ height: 10 }} />
              )}
            </View>
          );
        }}
        ItemSeparatorComponent={() => <View style={{ width: GOAL_GAP }} />}
      />

      {items.length > 1 ? (
        <View style={styles.goalIndicatorWrap}>
          {items.map((_, index) => (
            <View
              key={index}
              style={[styles.goalIndicatorDot, index === activeGoalCard ? styles.goalIndicatorDotActive : null]}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}
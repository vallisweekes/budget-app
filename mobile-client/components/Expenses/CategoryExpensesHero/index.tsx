import React from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { T } from "@/lib/theme";
import { withOpacity } from "@/lib/categoryColors";
import { fmt } from "@/lib/formatting";
import { categoryExpensesStyles as s } from "@/components/CategoryExpensesScreen/style";
import type { CategoryExpensesHeroProps } from "@/types";

export default function CategoryExpensesHero(props: CategoryExpensesHeroProps) {
  return (
    <View style={[s.hero, { paddingTop: props.topHeaderOffset + 14 }]}>
      <Pressable onPress={props.onPressMonth} style={s.heroMonthBtn} hitSlop={12}>
        <Text style={s.heroMonthText}>{props.heroPeriodLabel}</Text>
        <Ionicons name="chevron-down" size={14} color={withOpacity(T.onAccent, 0.8)} />
      </Pressable>
      <Text style={s.heroAmount}>{fmt(props.plannedTotal, props.currency)}</Text>
      <View style={s.heroPctPill}>
        <Text style={s.heroPctText}>{props.paidPct}%</Text>
      </View>
      <Text style={s.heroUpdated}>{props.updatedLabel}</Text>

      <View style={s.heroCards}>
        <View style={s.heroCard}>
          <Text style={s.heroCardLbl}>Paid</Text>
          <Text style={[s.heroCardVal, { color: T.green }]}>{fmt(props.paidTotal, props.currency)}</Text>
          <Text style={[s.heroCardPct, { color: withOpacity(T.green, 0.92) }]}>{props.paidPct}%</Text>
        </View>
        <View style={s.heroCard}>
          <Text style={s.heroCardLbl}>Remaining</Text>
          <Text style={[s.heroCardVal, { color: T.onAccent }]}>{fmt(props.remainingTotal, props.currency)}</Text>
          <Text style={s.heroCardPct}>{props.remainingPct}%</Text>
        </View>
      </View>

      {props.canAddExpenseInSelectedPeriod ? (
        <Pressable style={s.heroAddBtn} onPress={props.onPressAdd}>
          <Ionicons name="add" size={18} color={T.onAccent} />
          <Text style={s.heroAddTxt}>Expense</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

import React from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as LucideIcons from "lucide-react-native";

import type { Expense } from "@/lib/apiTypes";
import { resolveCategoryColor, withOpacity } from "@/lib/categoryColors";
import { fmt } from "@/lib/formatting";
import { T } from "@/lib/theme";
import { loggedExpensesStyles as s } from "@/screens/loggedExpenses/styles";

function CategoryIcon({ name, color }: { name: string | null | undefined; color: string }) {
  const Icon = name
    ? ((LucideIcons as Record<string, unknown>)[name] as
        | React.ComponentType<{ size: number; color: string; strokeWidth?: number }>
        | undefined)
    : undefined;

  return (
    <View style={[s.iconWrap, { backgroundColor: withOpacity(color, 0.13) }]}>
      {Icon ? <Icon size={18} color={color} strokeWidth={2} /> : <View style={[s.iconDot, { backgroundColor: color }]} />}
    </View>
  );
}

type Props = {
  categoryColor: string;
  categoryName?: string;
  currency: string;
  item: Expense;
  onPress: (item: Expense) => void;
};

export default function LoggedExpenseCard(props: Props) {
  return (
    <Pressable style={({ pressed }) => [s.card, pressed && s.cardPressed]} onPress={() => props.onPress(props.item)}>
      <View style={s.topRow}>
        <View style={s.left}>
          <CategoryIcon name={props.item.category?.icon} color={resolveCategoryColor(props.categoryColor ?? props.item.category?.color ?? null)} />
          <Text style={s.rowName} numberOfLines={1}>{props.item.name}</Text>
        </View>
        <View style={s.right}>
          <Text style={s.rowAmount}>{fmt(Number(props.item.amount), props.currency)}</Text>
          <Ionicons name="chevron-forward" size={16} color={T.textMuted} />
        </View>
      </View>

      <Text style={s.rowMeta}>
        {(props.item.category?.name ?? props.categoryName ?? "Uncategorised")} · {String(props.item.paymentSource ?? "").replace("_", " ")}
      </Text>

      <View style={s.track}>
        <View style={[s.fill, { width: "100%", backgroundColor: resolveCategoryColor(props.categoryColor ?? props.item.category?.color ?? null) }]} />
      </View>
    </Pressable>
  );
}
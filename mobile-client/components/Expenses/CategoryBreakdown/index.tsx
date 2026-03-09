import React from "react";
import { View, Text, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as LucideIcons from "lucide-react-native";
import type { ExpenseCategoryBreakdown } from "@/lib/apiTypes";
import { resolveCategoryColor, withOpacity } from "@/lib/categoryColors";
import { T } from "@/lib/theme";
import { cardElevated } from "@/lib/ui";
import { styles } from "./styles";
import type { CategoryBreakdownProps } from "@/types";

/** Resolve a Lucide icon name → component, or undefined if not found */
function CategoryIcon({ name, color }: { name: string | null; color: string }) {
  const Icon = name
    ? ((LucideIcons as Record<string, unknown>)[name] as
        | React.ComponentType<{ size: number; color: string; strokeWidth?: number }>
        | undefined)
    : undefined;
  return (
    <View style={[styles.iconWrap, { backgroundColor: withOpacity(color, 0.13) }]}> 
      {Icon ? (
        <Icon size={18} color={color} strokeWidth={2} />
      ) : (
        <View style={[styles.iconDot, { backgroundColor: color }]} />
      )}
    </View>
  );
}

export default function CategoryBreakdown({ categories, currency, fmt, onCategoryPress, onAddPress }: CategoryBreakdownProps) {
  if (categories.length === 0) return null;
  return (
    <View style={styles.wrap}>
      <View style={styles.labelRow}>
        <View />
        <Pressable onPress={onAddPress} style={styles.addBtn} hitSlop={8}>
          <Ionicons name="add" size={18} color={T.onAccent} />
          <Text style={styles.addBtnTxt}>Expense</Text>
        </Pressable>
      </View>
      {categories.map((cat) => {
        const paidClamped = cat.total > 0 ? Math.min(cat.paidTotal, cat.total) : 0;
        const pct = cat.total > 0 ? Math.round((paidClamped / cat.total) * 100) : 0;
        const color = resolveCategoryColor(cat.color);
        return (
          <Pressable
            key={cat.categoryId}
            style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
            onPress={() => onCategoryPress?.(cat)}
          >
            {/* Row 1: icon + name | amount + chevron */}
            <View style={styles.topRow}>
              <View style={styles.left}>
                <CategoryIcon name={cat.icon} color={color} />
                <Text style={styles.catName} numberOfLines={1}>{cat.name}</Text>
              </View>
              <View style={styles.right}>
                <Text style={styles.catTotal}>{fmt(cat.total, currency)}</Text>
                <Ionicons name="chevron-forward" size={16} color={T.textMuted} />
              </View>
            </View>

            {/* Row 2: paid summary */}
            <Text style={styles.sub}>
              {fmt(paidClamped, currency)} paid · {cat.paidCount}/{cat.totalCount}
            </Text>

            {/* Row 3: full-width progress bar */}
            <View style={styles.track}>
              <View
                style={[
                  styles.fill,
                  { backgroundColor: color, width: `${Math.min(pct, 100)}%` as `${number}%` },
                ]}
              />
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

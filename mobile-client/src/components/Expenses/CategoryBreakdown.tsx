import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as LucideIcons from "lucide-react-native";
import type { ExpenseCategoryBreakdown } from "@/lib/apiTypes";
import { resolveCategoryColor, withOpacity } from "@/lib/categoryColors";
import { T } from "@/lib/theme";
import { cardElevated } from "@/lib/ui";

/** Resolve a Lucide icon name → component, or undefined if not found */
function CategoryIcon({ name, color }: { name: string | null; color: string }) {
  const Icon = name
    ? ((LucideIcons as Record<string, unknown>)[name] as
        | React.ComponentType<{ size: number; color: string; strokeWidth?: number }>
        | undefined)
    : undefined;
  return (
    <View style={[s.iconWrap, { backgroundColor: withOpacity(color, 0.13) }]}> 
      {Icon ? (
        <Icon size={18} color={color} strokeWidth={2} />
      ) : (
        <View style={[s.iconDot, { backgroundColor: color }]} />
      )}
    </View>
  );
}

interface Props {
  categories: ExpenseCategoryBreakdown[];
  currency: string;
  fmt: (v: number, c: string) => string;
  onCategoryPress?: (cat: ExpenseCategoryBreakdown) => void;
  onAddPress?: () => void;
}

export default function CategoryBreakdown({ categories, currency, fmt, onCategoryPress, onAddPress }: Props) {
  if (categories.length === 0) return null;
  return (
    <View style={s.wrap}>
      <View style={s.labelRow}>
        <Text style={s.sectionLabel}>By category</Text>
        <Pressable onPress={onAddPress} style={s.addBtn} hitSlop={8}>
          <Ionicons name="add" size={18} color={T.onAccent} />
          <Text style={s.addBtnTxt}>Expense</Text>
        </Pressable>
      </View>
      {categories.map((cat) => {
        const pct = cat.total > 0 ? Math.round((cat.paidTotal / cat.total) * 100) : 0;
        const color = resolveCategoryColor(cat.color);
        return (
          <Pressable
            key={cat.categoryId}
            style={({ pressed }) => [s.card, pressed && s.cardPressed]}
            onPress={() => onCategoryPress?.(cat)}
          >
            {/* Row 1: icon + name | amount + chevron */}
            <View style={s.topRow}>
              <View style={s.left}>
                <CategoryIcon name={cat.icon} color={color} />
                <Text style={s.catName} numberOfLines={1}>{cat.name}</Text>
              </View>
              <View style={s.right}>
                <Text style={s.catTotal}>{fmt(cat.total, currency)}</Text>
                <Ionicons name="chevron-forward" size={16} color={T.textMuted} />
              </View>
            </View>

            {/* Row 2: paid summary */}
            <Text style={s.sub}>
              {fmt(cat.paidTotal, currency)} paid · {cat.paidCount}/{cat.totalCount}
            </Text>

            {/* Row 3: full-width progress bar */}
            <View style={s.track}>
              <View
                style={[
                  s.fill,
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

const s = StyleSheet.create({
  wrap: { paddingHorizontal: 14, paddingTop: 16, gap: 8 },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  addBtn: {
    backgroundColor: T.accent,
    paddingHorizontal: 10,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 4,
  },
  addBtnTxt: { color: T.onAccent, fontSize: 12, fontWeight: "800" },
  sectionLabel: {
    color: T.textDim,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 2,
  },

  card: {
    ...cardElevated,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 10,
    gap: 6,
  },
  cardPressed: { opacity: 0.75 },

  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  left: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1, minWidth: 0 },
  right: { flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 0 },

  iconWrap: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  iconDot: { width: 10, height: 10, borderRadius: 5 },
  catName: { color: T.text, fontSize: 14, fontWeight: "800", flex: 1 },
  catTotal: { color: T.text, fontSize: 15, fontWeight: "900" },

  sub: { color: T.textDim, fontSize: 12, paddingLeft: 46, fontWeight: "600" },

  track: {
    height: 6,
    backgroundColor: T.border,
    borderRadius: 3,
    overflow: "hidden",
    marginTop: 2,
  },
  fill: { height: "100%", borderRadius: 3 },
});

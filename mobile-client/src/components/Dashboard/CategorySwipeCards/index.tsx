import React, { useMemo, useState } from "react";
import { View, Text, FlatList, Dimensions, Pressable } from "react-native";
import type { DashboardCategoryItem } from "@/lib/apiTypes";
import { T } from "@/lib/theme";
import { pickAccent, tintedDarkBg } from "@/lib/domain/colorUtils";
import { cardElevated } from "@/lib/ui";
import { styles } from "./styles";
import type { CategorySwipeCardsProps } from "@/types";

const W = Dimensions.get("window").width;
const CARD = 122;
const GAP = 12;
const SIDE = 16;

const ACCENT_COLORS = [T.accent, T.green, "#a78bfa", T.orange, "#38bdf8", T.red] as const;

export default function CategorySwipeCards({ categories, totalIncome, currency, fmt, onPressCategory }: CategorySwipeCardsProps) {
  const [active, setActive] = useState(0);
  const data = useMemo(() => {
    const items = (categories ?? [])
      .filter((c) => (c.total ?? 0) > 0)
      .slice()
      .sort((a, b) => (b.total ?? 0) - (a.total ?? 0));

    return items.map((c) => {
      const pct = totalIncome > 0 ? Math.round(((c.total ?? 0) / totalIncome) * 100) : 0;
      const accent = pickAccent(c.id || c.name, ACCENT_COLORS);
      return {
        id: c.id,
        name: c.name,
        total: c.total ?? 0,
        pct,
        accent,
      };
    });
  }, [categories, totalIncome]);

  if (data.length === 0) return null;

  const snap = CARD + GAP;
  const padRight = Math.max(SIDE, W - SIDE - CARD);

  return (
    <View style={styles.wrap}>
      <FlatList
        horizontal
        data={data}
        keyExtractor={(i) => i.id || i.name}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingLeft: SIDE, paddingRight: padRight }}
        snapToInterval={snap}
        decelerationRate="fast"
        bounces
        onMomentumScrollEnd={(e) => {
          const x = e.nativeEvent.contentOffset.x;
          const i = Math.round(x / snap);
          setActive(Math.max(0, Math.min(data.length - 1, i)));
        }}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => onPressCategory?.({ id: item.id, name: item.name })}
            style={[styles.card, { backgroundColor: tintedDarkBg(item.accent, T.card) }]}
          >
            <View style={styles.top}>
              <View style={styles.pill}>
                <Text style={styles.pillTxt}>{item.pct}%</Text>
              </View>
            </View>

            <Text style={styles.name} numberOfLines={1}>
              {item.name}
            </Text>
            <Text style={styles.amount} numberOfLines={1}>
              {fmt(item.total, currency)}
            </Text>
          </Pressable>
        )}
        ItemSeparatorComponent={() => <View style={{ width: GAP }} />}
      />

      {data.length > 1 ? (
        <View style={styles.indicatorWrap}>
          {data.map((_, i) => (
            <View key={i} style={[styles.indicatorDot, i === active ? styles.indicatorDotActive : null]} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

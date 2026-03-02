import React, { useMemo, useState } from "react";
import { View, Text, FlatList, Dimensions, Pressable } from "react-native";
import type { DashboardCategoryItem } from "@/lib/apiTypes";
import { T } from "@/lib/theme";
import { cardElevated } from "@/lib/ui";
import { styles } from "./styles";
import type { CategorySwipeCardsProps } from "@/types";

const W = Dimensions.get("window").width;
const CARD = 122;
const GAP = 12;
const SIDE = 16;

const ACCENT_COLORS = [T.accent, T.green, "#a78bfa", T.orange, "#38bdf8", T.red] as const;

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function pickAccent(seed: string): string {
  return ACCENT_COLORS[hashString(seed) % ACCENT_COLORS.length]!;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = hex.replace("#", "");
  if (m.length !== 6) return null;
  const r = parseInt(m.slice(0, 2), 16);
  const g = parseInt(m.slice(2, 4), 16);
  const b = parseInt(m.slice(4, 6), 16);
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return null;
  return { r, g, b };
}

function blendRgb(a: { r: number; g: number; b: number }, b: { r: number; g: number; b: number }, t: number) {
  const tt = Math.min(1, Math.max(0, t));
  const r = Math.round(a.r * (1 - tt) + b.r * tt);
  const g = Math.round(a.g * (1 - tt) + b.g * tt);
  const bb = Math.round(a.b * (1 - tt) + b.b * tt);
  return { r, g, b: bb };
}

function tintedDarkBg(accentHex: string): string {
  const base = hexToRgb(T.card) ?? { r: 15, g: 40, b: 47 };
  const rgb = hexToRgb(accentHex);
  if (!rgb) return `rgb(${base.r},${base.g},${base.b})`;
  const mixed = blendRgb(base, rgb, 0.14);
  return `rgb(${mixed.r},${mixed.g},${mixed.b})`;
}

export default function CategorySwipeCards({ categories, totalIncome, currency, fmt, onPressCategory }: CategorySwipeCardsProps) {
  const [active, setActive] = useState(0);
  const data = useMemo(() => {
    const items = (categories ?? [])
      .filter((c) => (c.total ?? 0) > 0)
      .slice()
      .sort((a, b) => (b.total ?? 0) - (a.total ?? 0));

    return items.map((c) => {
      const pct = totalIncome > 0 ? Math.round(((c.total ?? 0) / totalIncome) * 100) : 0;
      const accent = pickAccent(c.id || c.name);
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
            style={[styles.card, { backgroundColor: tintedDarkBg(item.accent) }]}
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
